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
  | "DiagnosticRecommendation"
  | "RecallGrading";

export const TEMPERATURE_STRATEGY_MAP: Record<TaskType, number> = {
  AcademicExplanation: 0.15,    // Low temperature for strict scientific accuracy and evidence adherence
  SocraticGuidance: 0.40,       // Moderate temperature for pedagogical prompting
  ExampleGeneration: 0.50,      // Balanced temperature for realistic, creative examples
  QuizGeneration: 0.70,         // Higher temperature for diverse distractor generation
  GeneralChat: 0.60,            // Conversational balance
  DiagnosticRecommendation: 0.30, // Low-moderate temperature for structured analytical diagnostics
  /*
    Chấm bài nhớ lại: nhiệt độ THẤP NHẤT thang, thấp hơn cả giải thích học thuật.

    Vì sao thấp hơn hẳn: kết quả chấm chảy thẳng vào đường cong quên làm bằng chứng. Cùng một bài
    viết mà hôm nay chấm đạt, mai chấm chưa đạt, thì thứ nhiễu ấy không dừng ở màn hình mà đi vào
    lịch ôn của những tuần sau. Giải thích sai một chút thì người học đọc và tự lọc được, chấm sai
    một chút thì không ai thấy.
  */
  RecallGrading: 0.05
};

export const temperatureStrategy = {
  getTemperature(taskType: TaskType): number {
    return TEMPERATURE_STRATEGY_MAP[taskType] ?? 0.3;
  }
};
