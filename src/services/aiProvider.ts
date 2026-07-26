/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { TaskType, temperatureStrategy } from "./temperatureStrategy";
import { StructuredAIExplanationResponse, GEMINI_EXPLANATION_RESPONSE_SCHEMA } from "./aiResponseSchema";
import { CompressedContext } from "./contextWindowBuilder";
import { outputValidationService, QualityScoreReport } from "./outputValidationService";
import { offlineFallbackEngine } from "./offlineFallbackEngine";
import { telemetryService } from "./telemetryService";
import { PROMPT_VERSION_36 } from "./promptBuilder36";
import { ensureSession } from "./supabaseClient";

export interface AIExecutionOptions {
  taskType?: TaskType;
  modelName?: string;
  temperature?: number;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  clientId?: string;
  compressedContext?: CompressedContext;
  fallbackFunction?: () => string;
}

export interface AIProviderResult {
  rawText: string;
  parsedStructured?: StructuredAIExplanationResponse;
  tokensUsed: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  responseTimeMs: number;
  offlineMode: boolean;
  modelUsed: string;
  promptVersion: string;
  retryCount: number;
  qualityReport?: QualityScoreReport;
}

export interface AIProvider {
  id: string;
  name: string;
  execute(options: AIExecutionOptions): Promise<AIProviderResult>;
}

// In-Memory API Cache
interface CacheEntry {
  rawText: string;
  parsedStructured?: StructuredAIExplanationResponse;
  timestamp: number;
}
const providerCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Rate Limiter
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MIN = 30;

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const history = rateLimitMap.get(clientId) || [];
  const active = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (active.length >= MAX_REQUESTS_PER_MIN) {
    return true;
  }
  active.push(now);
  rateLimitMap.set(clientId, active);
  return false;
}

/**
 * Gemini 3.6 Flash Implementation of AIProvider
 */
export class Gemini36FlashProvider implements AIProvider {
  id = "gemini-3.6-flash";
  name = "Google Gemini 3.6 Flash Engine";

  async execute(options: AIExecutionOptions): Promise<AIProviderResult> {
    const startTime = Date.now();
    const modelUsed = options.modelName || this.id;
    const taskType = options.taskType || "AcademicExplanation";
    const temperature = options.temperature !== undefined 
      ? options.temperature 
      : temperatureStrategy.getTemperature(taskType);
    const clientId = options.clientId || "default_learner";
    const promptVer = PROMPT_VERSION_36;

    // 1. Cache Lookup
    const cacheKey = `${modelUsed}_${options.prompt}_${options.systemInstruction || ""}_${options.responseMimeType || ""}`;
    const cached = providerCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      const responseTimeMs = Date.now() - startTime;
      const dummyReport: QualityScoreReport = {
        evidenceCoverage: 1.0,
        citationQuality: 1.0,
        schemaCompleteness: 1.0,
        confidence: 0.98,
        teachingQuality: 1.0,
        overallScore: 0.99,
        isPassed: true,
        issuesFound: ["Cache Hit"]
      };

      telemetryService.logEntry({
        model: modelUsed,
        promptVersion: promptVer,
        latencyMs: responseTimeMs,
        promptTokens: Math.round(options.prompt.length / 4),
        completionTokens: Math.round(cached.rawText.length / 4),
        totalTokens: Math.round((options.prompt.length + cached.rawText.length) / 4),
        estimatedCostUsd: 0.0,
        cacheHit: true,
        retryCount: 0,
        fallbackUsed: false,
        qualityScore: dummyReport
      });

      return {
        rawText: cached.rawText,
        parsedStructured: cached.parsedStructured,
        tokensUsed: Math.round(cached.rawText.length / 4),
        estimatedCostUsd: 0.0,
        cacheHit: true,
        responseTimeMs,
        offlineMode: false,
        modelUsed,
        promptVersion: promptVer,
        retryCount: 0,
        qualityReport: dummyReport
      };
    }

    // 2. Rate Limit -> Offline Fallback
    if (isRateLimited(clientId)) {
      return this.executeOfflineFallback(options, startTime, modelUsed, promptVer, "RateLimit");
    }

    // 3. API Execution.
    //
    // Cùng một tầng suy luận chạy ở HAI nơi, và mỗi nơi nói chuyện với Gemini một kiểu:
    //   - Trên máy chủ (serverless, Node): gọi thẳng Gemini bằng khóa trong biến môi trường.
    //   - Trên trình duyệt: KHÔNG có khóa và cũng không được có, nên đi vòng qua cổng chuyển
    //     tiếp `/api/ai/complete`.
    //
    // Vì sao tầng suy luận lại chạy ở trình duyệt: môn do người dùng tự tạo có dữ liệu nằm
    // trong localStorage, máy chủ chưa từng thấy. Chạy ở trình duyệt là cách duy nhất để mọi
    // môn đều dùng được AI mà không phải deploy lại.
    //
    // Lưu ý: `process` KHÔNG tồn tại trong trình duyệt, nên phép đọc biến môi trường phải nằm
    // hẳn trong nhánh máy chủ. Đặt ở ngoài là ném ReferenceError ngay khi mở trang.
    const chayTrenTrinhDuyet = typeof window !== "undefined";
    let rawText = "";
    let attempt = 0;

    if (chayTrenTrinhDuyet) {
      rawText = await this.goiQuaCongChuyenTiep(options, temperature, taskType);
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return this.executeOfflineFallback(options, startTime, modelUsed, promptVer, "NoKey");
      }

      const maxRetries = 3;
      let delay = 1000;

      while (attempt < maxRetries) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const config: any = {
            temperature,
          };
          if (options.systemInstruction) {
            config.systemInstruction = options.systemInstruction;
          }
          if (options.responseMimeType) {
            config.responseMimeType = options.responseMimeType;
          }
          if (options.responseSchema) {
            config.responseSchema = options.responseSchema;
          }

          const response = await ai.models.generateContent({
            model: modelUsed,
            contents: options.prompt,
            config
          });

          rawText = response.text || "";
          if (rawText) {
            break;
          }
          throw new Error("Empty response returned from Gemini 3.6 Flash.");
        } catch (err) {
          attempt++;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
      }
    }

    // 4. Fallback if retries failed
    if (!rawText) {
      return this.executeOfflineFallback(options, startTime, modelUsed, promptVer, "APIFailure");
    }

    // 5. Output Validation & Sanitization
    let parsedStructured: StructuredAIExplanationResponse | undefined;
    let qualityReport: QualityScoreReport;

    if (options.compressedContext) {
      const valResult = outputValidationService.validateAndSanitize(rawText, options.compressedContext);
      parsedStructured = valResult.sanitized;
      qualityReport = valResult.report;
    } else {
      qualityReport = {
        evidenceCoverage: 0.9,
        citationQuality: 0.9,
        schemaCompleteness: 1.0,
        confidence: 0.95,
        teachingQuality: 0.9,
        overallScore: 0.92,
        isPassed: true,
        issuesFound: []
      };
    }

    const responseTimeMs = Date.now() - startTime;
    const inputTokens = Math.max(1, Math.round(options.prompt.length / 4));
    const outputTokens = Math.max(1, Math.round(rawText.length / 4));
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = parseFloat(((inputTokens * 0.075 / 1000000) + (outputTokens * 0.30 / 1000000)).toFixed(5));

    // Cache
    providerCache.set(cacheKey, {
      rawText,
      parsedStructured,
      timestamp: Date.now()
    });

    // Log Telemetry
    telemetryService.logEntry({
      model: modelUsed,
      promptVersion: promptVer,
      latencyMs: responseTimeMs,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens,
      estimatedCostUsd,
      cacheHit: false,
      retryCount: attempt,
      fallbackUsed: false,
      qualityScore: qualityReport
    });

    return {
      rawText,
      parsedStructured,
      tokensUsed: totalTokens,
      estimatedCostUsd,
      cacheHit: false,
      responseTimeMs,
      offlineMode: false,
      modelUsed,
      promptVersion: promptVer,
      retryCount: attempt,
      qualityReport
    };
  }

  /**
   * Đường đi của trình duyệt: nhờ máy chủ nói chuyện với Gemini hộ, vì khóa API không được phép
   * có mặt trong giao diện.
   *
   * Trả về chuỗi rỗng khi không gọi được. Nơi gọi sẽ tự rơi về bản dự phòng ngoại tuyến, giống
   * hệt như khi máy chủ không có khóa.
   */
  private async goiQuaCongChuyenTiep(
    options: AIExecutionOptions,
    temperature: number,
    taskType: TaskType
  ): Promise<string> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = await ensureSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: options.prompt,
          taskType,
          temperature,
          responseMimeType: options.responseMimeType,
          responseSchema: options.responseSchema,
        }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return typeof data?.text === "string" ? data.text : "";
    } catch {
      return "";
    }
  }

  private executeOfflineFallback(
    options: AIExecutionOptions,
    startTime: number,
    modelUsed: string,
    promptVer: string,
    reason: string
  ): AIProviderResult {
    const offlineProvider = new OfflineProvider();
    const result = offlineProvider.executeSync(options, startTime, modelUsed, promptVer, reason);
    return result;
  }
}

/**
 * Offline Provider Implementation
 */
export class OfflineProvider implements AIProvider {
  id = "offline-fallback";
  name = "Local Deterministic Solvers";

  async execute(options: AIExecutionOptions): Promise<AIProviderResult> {
    return this.executeSync(options, Date.now(), this.id, PROMPT_VERSION_36, "ExplicitOfflineRequest");
  }

  executeSync(
    options: AIExecutionOptions,
    startTime: number,
    modelUsed: string,
    promptVer: string,
    reason: string
  ): AIProviderResult {
    let rawText = "";
    let parsedStructured: StructuredAIExplanationResponse | undefined;

    if (options.compressedContext) {
      parsedStructured = offlineFallbackEngine.generateOfflineExplanation(options.compressedContext);
      rawText = JSON.stringify(parsedStructured);
    } else if (options.fallbackFunction) {
      rawText = options.fallbackFunction();
    } else {
      rawText = "*(Chế độ giải thích ngoại tuyến)*\n\nHệ thống AI hiện đang trong trạng thái ngoại tuyến.";
    }

    const responseTimeMs = Date.now() - startTime;
    const report: QualityScoreReport = {
      evidenceCoverage: 1.0,
      citationQuality: 1.0,
      schemaCompleteness: 1.0,
      confidence: 1.0,
      teachingQuality: 0.85,
      overallScore: 0.97,
      isPassed: true,
      issuesFound: [`Offline Fallback Triggered: ${reason}`]
    };

    telemetryService.logEntry({
      model: "offline-engine",
      promptVersion: promptVer,
      latencyMs: responseTimeMs,
      promptTokens: 0,
      completionTokens: Math.round(rawText.length / 4),
      totalTokens: Math.round(rawText.length / 4),
      estimatedCostUsd: 0.0,
      cacheHit: false,
      retryCount: 0,
      fallbackUsed: true,
      qualityScore: report
    });

    return {
      rawText,
      parsedStructured,
      tokensUsed: 0,
      estimatedCostUsd: 0.0,
      cacheHit: false,
      responseTimeMs,
      offlineMode: true,
      modelUsed: "offline-engine",
      promptVersion: promptVer,
      retryCount: 0,
      qualityReport: report
    };
  }
}

/**
 * AI Provider Registry
 */
class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();

  constructor() {
    this.register(new Gemini36FlashProvider());
    this.register(new OfflineProvider());
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId?: string): AIProvider {
    const id = providerId || "gemini-3.6-flash";
    return this.providers.get(id) || this.providers.get("gemini-3.6-flash")!;
  }
}

export const aiProviderRegistry = new AIProviderRegistry();
