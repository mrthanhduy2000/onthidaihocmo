/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskType = 
  | "AcademicExplanation" 
  | "SocraticGuidance" 
  | "ExampleGeneration" 
  | "QuizGeneration" 
  | "GeneralChat" 
  | "DiagnosticRecommendation";

export const TEMPERATURE_STRATEGY_MAP: Record<TaskType, number> = {
  AcademicExplanation: 0.15,    // Low temperature for strict scientific accuracy and evidence adherence
  SocraticGuidance: 0.40,       // Moderate temperature for pedagogical prompting
  ExampleGeneration: 0.50,      // Balanced temperature for realistic, creative examples
  QuizGeneration: 0.70,         // Higher temperature for diverse distractor generation
  GeneralChat: 0.60,            // Conversational balance
  DiagnosticRecommendation: 0.30 // Low-moderate temperature for structured analytical diagnostics
};

export const temperatureStrategy = {
  getTemperature(taskType: TaskType): number {
    return TEMPERATURE_STRATEGY_MAP[taskType] ?? 0.3;
  }
};
