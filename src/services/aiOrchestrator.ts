/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { learnerModelService } from "./learnerModel";
import { TimeService } from "./time";
import { aiProviderRegistry } from "./aiProvider";
import { TaskType } from "./temperatureStrategy";

// Model Cost pricing coefficients for gemini-3.6-flash (approximate USD per 1M tokens)
const INPUT_PRICE_PER_MILLION_USD = 0.075;
const OUTPUT_PRICE_PER_MILLION_USD = 0.30;

// Simple Cache Store (In-Memory)
interface CacheEntry {
  response: string;
  timestamp: number;
}
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache lifetime

// Simple IP / Client Rate Limiter Store
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // max 20 API calls per minute

export interface OrchestrationResult {
  text: string;
  tokensUsed: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  responseTimeMs: number;
  offlineMode: boolean;
}

export class PromptBuilder {
  private system: string = "";
  private subject: string = "";
  private concept: string = "";
  private learner: string = "";
  private style: string = "";
  private query: string = "";

  setSystem(sys: string) { this.system = sys; return this; }
  setSubject(sub: string) { this.subject = sub; return this; }
  setConceptContext(con: string) { this.concept = con; return this; }
  setLearnerContext(lrn: string) { this.learner = lrn; return this; }
  setTeachingStyle(sty: string) { this.style = sty; return this; }
  setUserQuery(qry: string) { this.query = qry; return this; }

  build(): string {
    return [
      this.system ? `========================\nSYSTEM ROLE\n========================\n${this.system}\n` : "",
      this.subject ? `========================\nSUBJECT RULES\n========================\n${this.subject}\n` : "",
      this.concept ? `========================\nKNOWLEDGE EVIDENCE\n========================\n${this.concept}\n` : "",
      this.learner ? `========================\nSTUDENT PROFILE\n========================\n${this.learner}\n` : "",
      this.style ? `========================\nLEARNING PLAN\n========================\n${this.style}\n` : "",
      `========================\nUSER INQUIRY\n========================\n${this.query}`
    ].filter(Boolean).join("\n----------------------------------------\n");
  }
}

export const aiOrchestrator = {
  /**
   * Sanitizes input strings to block typical Prompt Injection attempts.
   */
  detectAndDefusePromptInjection(text: string): string {
    const injectionPatterns = [
      /ignore previous/i,
      /forget all regulations/i,
      /system override/i,
      /you are now a/i,
      /coi như quên hết các quy định/i,
      /bỏ qua các chỉ dẫn/i,
      /quên luật chơi/i,
      /trở thành một/i,
      /vượt qua lớp bảo mật/i
    ];

    let cleanText = text;
    let flagged = false;

    for (const pattern of injectionPatterns) {
      if (pattern.test(text)) {
        cleanText = cleanText.replace(pattern, "[ĐÃ BỊ PHÁT HIỆN VÀ GỠ BỎ]");
        flagged = true;
      }
    }

    if (flagged) {
      console.warn("Prompt injection attempted and neutralized:", text);
    }
    return cleanText;
  },

  /**
   * Dynamic history and context trimming based on character length.
   * Compresses content safely to fit inside token boundaries and save budget costs.
   */
  compressContext(contents: any[]): any[] {
    const MAX_PART_LENGTH = 12000; // Limit parts size
    return contents.map(c => {
      if (c.parts && Array.isArray(c.parts)) {
        return {
          ...c,
          parts: c.parts.map((p: any) => {
            if (p.text && p.text.length > MAX_PART_LENGTH) {
              return { text: p.text.slice(0, MAX_PART_LENGTH) + "\n[Nội dung quá dài đã được thu gọn để tiết kiệm chi phí...]" };
            }
            return p;
          })
        };
      }
      return c;
    });
  },

  /**
   * Rates limits clients based on simple key identifier
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const timestamps = rateLimitStore.get(clientId) || [];
    
    // Filter old timestamps
    const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    
    if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return false; // rate limited!
    }
    
    activeTimestamps.push(now);
    rateLimitStore.set(clientId, activeTimestamps);
    return true;
  },

  /**
   * Safe execution of Gemini calls wrapping retries, exponential backoffs, cache lookups,
   * cost computation, offline fallback routing via AIProvider abstraction.
   */
  async executeWithOrchestration(params: {
    taskType?: TaskType;
    modelName?: string;
    prompt: string;
    systemInstruction?: string;
    clientId?: string;
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
    fallbackFunction: () => string;
  }): Promise<OrchestrationResult> {
    const sanitizedPrompt = this.detectAndDefusePromptInjection(params.prompt);
    const provider = aiProviderRegistry.getProvider("gemini-3.6-flash");

    const res = await provider.execute({
      taskType: params.taskType,
      modelName: params.modelName,
      prompt: sanitizedPrompt,
      systemInstruction: params.systemInstruction,
      responseMimeType: params.responseMimeType,
      responseSchema: params.responseSchema,
      temperature: params.temperature,
      clientId: params.clientId,
      fallbackFunction: params.fallbackFunction
    });

    if (!res.offlineMode) {
      learnerModelService.logAiCall(res.tokensUsed, res.estimatedCostUsd, res.responseTimeMs, res.cacheHit);
    } else {
      learnerModelService.logAiOfflineFallback();
    }

    return {
      text: res.rawText,
      tokensUsed: res.tokensUsed,
      estimatedCostUsd: res.estimatedCostUsd,
      cacheHit: res.cacheHit,
      responseTimeMs: res.responseTimeMs,
      offlineMode: res.offlineMode
    };
  }
};
