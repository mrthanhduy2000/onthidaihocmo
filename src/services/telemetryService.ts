/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QualityScoreReport } from "./outputValidationService";

export interface TelemetryLogEntry {
  timestamp: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  retryCount: number;
  fallbackUsed: boolean;
  qualityScore: QualityScoreReport;
}

const telemetryLogs: TelemetryLogEntry[] = [];
const MAX_TELEMETRY_LOGS = 100;

export const telemetryService = {
  logEntry(entry: Omit<TelemetryLogEntry, "timestamp">): void {
    const fullLog: TelemetryLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    telemetryLogs.unshift(fullLog);
    if (telemetryLogs.length > MAX_TELEMETRY_LOGS) {
      telemetryLogs.pop();
    }

    // Server/internal console trace for observability
    console.log(
      `[AI TELEMETRY] Model: ${fullLog.model} | Ver: ${fullLog.promptVersion} | Latency: ${fullLog.latencyMs}ms | Tokens: ${fullLog.totalTokens} | Cost: $${fullLog.estimatedCostUsd} | Quality: ${fullLog.qualityScore.overallScore * 100}% | Fallback: ${fullLog.fallbackUsed}`
    );
  },

  getRecentLogs(): TelemetryLogEntry[] {
    return [...telemetryLogs];
  },

  getAggregateStats() {
    if (telemetryLogs.length === 0) {
      return { totalCalls: 0, avgLatencyMs: 0, totalTokens: 0, totalCostUsd: 0, avgQualityScore: 0 };
    }
    const totalCalls = telemetryLogs.length;
    const totalLatency = telemetryLogs.reduce((acc, l) => acc + l.latencyMs, 0);
    const totalTokens = telemetryLogs.reduce((acc, l) => acc + l.totalTokens, 0);
    const totalCostUsd = telemetryLogs.reduce((acc, l) => acc + l.estimatedCostUsd, 0);
    const totalQuality = telemetryLogs.reduce((acc, l) => acc + l.qualityScore.overallScore, 0);

    return {
      totalCalls,
      avgLatencyMs: Math.round(totalLatency / totalCalls),
      totalTokens,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(5)),
      avgQualityScore: parseFloat((totalQuality / totalCalls).toFixed(2))
    };
  }
};
