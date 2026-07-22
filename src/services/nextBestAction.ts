/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NextBestActionType = 
  | "continue-exam" 
  | "retention-revision" 
  | "daily-adaptive" 
  | "mock-exam" 
  | "chapter-strengthen";

export interface NextBestAction {
  type: NextBestActionType;
  title: string;
  subtitle: string;
  estimatedTimeMinutes: number;
  expectedBenefit: string;
  reason: string;
  confidence: number; // 0 - 100
  primaryAction: {
    label: string;
    examType: "adaptive" | "mock" | "incorrect" | "chapter" | "ai-smart" | "continue";
    chapterId?: number;
    count?: number;
    unsubmittedExamId?: string;
  };
  secondaryAction?: {
    label: string;
    actionType: "review-notebook" | "practice-center" | "analytics";
  };
}
