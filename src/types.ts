/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Chapter {
  id: number;
  code: string; // e.g. "CH1", "CH2"
  title: string;
  description: string;
}

export interface Topic {
  id: string; // e.g. "T1.1", "T2.3"
  chapterId: number;
  title: string;
  description: string;
}

export type DifficultyLevel = "Dễ" | "Trung bình" | "Khó" | "Rất khó";
export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
export type BlueprintType = 
  | "scenario-based" 
  | "misconception-analysis" 
  | "definition-recall" 
  | "comparative-analysis" 
  | "cause-effect-linking" 
  | "cause-effect-reasoning"
  | "policy-evaluation"
  | "step-by-step-problem-solving"
  | string;

export interface Question {
  id: number;
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: "a" | "b" | "c" | "d";
  chapterId: number;
  topicId: string;
  difficulty: DifficultyLevel;
  difficultyRating: number; // 1-5 stars
  explanation: string;
  sourcePdf: string; // e.g. "FULL CHƯƠNG.pdf" or "Slide bài giảng"
  sourcePage: number | string; // page number or slide number
  knowledgeMapping: string[]; // keywords/tags
  relatedQuestions: number[]; // related question IDs
  estimatedTime: number; // in seconds
  questionType: "multiple-choice";
  learningObjective: string;
  // Audit and expansion fields
  questionCode?: string; // Unique standardized reference code, e.g. "POLI-CH1-Q001"
  createdAt?: string;    // Metadata creation timestamp
  updatedAt?: string;    // Metadata modification timestamp
  version?: number;      // Question versioning for content revisions
  tags?: string[];       // Extra keywords and tags for flexible filtering
  concept?: string;      // Theoretical concept linked, e.g. "Derived Demand"
  misconception?: string;// Common misconception tested, e.g. "Direct Demand"
  bloomLevel?: string;   // Bloom taxonomy classification
  metadata?: GeneratedQuestionMetadata;
  pedagogicalMetadata?: PedagogicalMetadata;
}

export interface QuestionSpecification {
  learningObjective: string;
  conceptId: string;
  conceptName: string;
  chapterId: number;
  topicId: string;
  subjectId: string;
  blueprint: string;
  bloomLevel: string;
  difficulty: DifficultyLevel;
  targetStudentLevel: string;
  pedagogicalReason: string;
  expectedMisconception: string;
  prerequisiteConcepts: string[];
  evidenceIds: string[];
  distractorStrategy: string[];
  generationConstraints: string[];
}

export interface PedagogicalQualityMetrics {
  questionAmbiguity: number;
  answerUniqueness: number;
  distractorPlausibility: number;
  pedagogicalClarity: number;
  evidenceSufficiency: number;
  blueprintConsistency: number;
  bloomConsistency: number;
  difficultyConsistency: number;
  teachingValue: number;
  questionOriginality: number;
}

export interface PedagogicalMetadata {
  learningObjective: string;
  pedagogicalReason: string;
  expectedMisconception: string;
  whyBlueprintSelected: string;
  whyDifficultySelected: string;
  reviewPassed: boolean;
  reviewIssues: string[];
  reviewScore: number;
  metrics?: PedagogicalQualityMetrics;
}

export interface GeneratedQuestionMetadata {
  questionId: string | number;
  subjectId: string;
  chapterId: number;
  conceptId: string;
  blueprintId: string;
  evidenceIds: string[];
  difficulty: number;
  bloomLevel: string;
  generationStrategy: string;
  generatedAt: string;
  generatorVersion: string;
  groundingScore: number;
  qualityMetrics?: {
    overallScore: number;
    conceptCoverage: number;
    distractorQuality: number;
    bloomAccuracy: number;
    evidenceCoverage: number;
    difficultyConfidence: number;
    pedagogicalValue: number;
    questionDiversity: number;
  };
}

export interface QuestionSpecification {
  questionIndex: number;
  concept: string;
  chapterId: number;
  topicId: string;
  bloom: BloomLevel;
  difficulty: DifficultyLevel;
  blueprint: BlueprintType;
  evidenceIds: string[];
  reason: string;
  targetMisconception?: string;
}

export interface ExamSpecification {
  id: string;
  examType: string;
  subjectId: string;
  questionCount: number;
  questionSpecs: QuestionSpecification[];
  coverage: Record<number, number>; // chapterId -> count
  bloomDistribution: Record<string, { count: number; percentage: number }>;
  difficultyDistribution: Record<string, { count: number; percentage: number }>;
  blueprintDistribution: Record<string, { count: number; percentage: number }>;
  rhythmSequence: string[];
  plannedTimeMinutes: number;
  generatorVersion: string;
  createdAt: string;
}

export interface ExamReviewResult {
  passed: boolean;
  overallScore: number;
  checks: {
    coverage: { status: "PASS" | "WARN" | "FAIL"; details: string };
    bloom: { status: "PASS" | "WARN" | "FAIL"; details: string };
    difficulty: { status: "PASS" | "WARN" | "FAIL"; details: string };
    redundancy: { status: "PASS" | "WARN" | "FAIL"; details: string };
    conceptBalance: { status: "PASS" | "WARN" | "FAIL"; details: string };
    rhythm: { status: "PASS" | "WARN" | "FAIL"; details: string };
    expectedTime: { status: "PASS" | "WARN" | "FAIL"; details: string };
  };
  recommendations: string[];
  reviewedAt: string;
}

export interface ExamAttempt {
  id: string;
  examType: "sequential" | "random" | "ai-smart" | "chapter" | "topic" | "difficulty" | "incorrect" | "bookmark" | "adaptive" | "custom" | "due" | "recall";
  chapterId?: number;
  topicId?: string;
  difficulty?: DifficultyLevel;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  questions: number[]; // question IDs in order
  answers: Record<number, "a" | "b" | "c" | "d">; // questionID -> selectedOption
  bookmarks: number[]; // bookmarked question IDs
  flags: number[]; // flagged question IDs
  isSubmitted: boolean;
  score: number; // number of correct answers
  timeSpent: number; // in seconds
  /**
   * Số giây đã ở trên TỪNG CÂU, tra theo mã câu.
   *
   * BẮT BUỘC để tùy chọn. Mọi bản ghi lịch sử có trước 13/08/2026 không có trường này, và nếu để
   * bắt buộc thì mọi engine đọc lịch sử cũ sẽ nổ.
   *
   * Vì sao cần: trước đây ứng dụng CHỈ ghi tổng thời gian cả lượt, nên `averageResponseTime` theo
   * khái niệm là chia đều chứ không phải đo, `responseTimeImprovement` chỉ có một giá trị duy
   * nhất, và phát hiện đoán mò phải dựa vào `estimatedTime` vốn bằng đúng 35,0 giây cho cả ba mức
   * khó trên 280 câu.
   *
   * Đã cân nhắc phân bổ tổng thời gian theo `estimatedTime` và BÁC BỎ: trường đó không bám độ
   * khó, chia theo nó chỉ tạo phân hóa giả.
   *
   * Việc này KHÔNG hồi tố được, chỉ có tác dụng từ lúc bật.
   */
  answerTimings?: Record<number, number>;
  /**
   * Các lượt NHỚ LẠI CHỦ ĐỘNG của phiên này. Rỗng hoặc vắng với đề trắc nghiệm.
   *
   * Vì sao nhét vào chính `ExamAttempt` thay vì dựng một kho riêng: bất biến 4.9e nói
   * `dbService.addOnSubmit` là **cây cầu duy nhất** giữa việc học và tầng trí nhớ. Một kho riêng
   * sẽ cần một cây cầu thứ hai, và hai cây cầu là đúng cái đã sinh ra "hai đường cong quên" phải
   * gộp lại hồi tháng 7. Nhớ lại đi chung một chuyến với trắc nghiệm, chỉ khác nội dung chở.
   */
  recallAttempts?: RecallAttempt[];
  examSpecification?: ExamSpecification;
  examReviewResult?: ExamReviewResult;
}

/**
 * Một câu hỏi mở dựng từ MỘT nút đồ thị tri thức.
 *
 * Sinh tất định ngay trong trình duyệt, KHÔNG gọi AI. Nút tri thức đã có sẵn định nghĩa, ý chi
 * tiết, bẫy hiểu sai và mẹo nhớ do người soạn viết tay; hỏi AI viết lại chỉ tốn một lượt gọi để
 * nhận về thứ kém hơn bản gốc, và làm câu hỏi đổi mỗi lần mở màn hình.
 */
export interface RecallPrompt {
  /** Tên khái niệm theo đồ thị tri thức, tức bộ tra chính thống (bất biến 4.5). */
  conceptName: string;
  /** Câu hỏi mở hiện cho người học. Không chứa đáp án. */
  prompt: string;
  /** Các ý người học cần nêu được. Đây là thước chấm, và TUYỆT ĐỐI không hiện trước khi nộp. */
  expectedPoints: string[];
  /** Nguồn của nút tri thức, để phần chấm trích dẫn được chứ không phán suông. */
  sourceEvidence: string;
  /** Bẫy hiểu sai đã ghi sẵn trong nút. Rỗng khi nút không ghi. */
  misconceptionToWatch: string;
}

/**
 * Kết quả chấm MỘT lượt nhớ lại.
 *
 * `duDuLieu: false` nghĩa là CHƯA CHẤM ĐƯỢC, không phải chấm ra 0 điểm. Hai thứ đó khác nhau về
 * bản chất và màn hình phải nói khác nhau: một bên là "mô hình không trả lời hợp lệ", một bên là
 * "bạn trả lời sai". Nhầm hai thứ này là dựng điểm giả, đúng thứ bất biến 4.9 cấm.
 */
export interface RecallAttempt {
  conceptName: string;
  /** Nguyên văn người học gõ. Giữ lại để về sau đối chiếu được cách chấm. */
  answerText: string;
  gradedAt: string;
  /** `null` khi chưa chấm được. */
  passed: boolean | null;
  /** Các ý người học ĐÃ nêu được. */
  hitPoints: string[];
  /** Các ý còn thiếu. */
  missingPoints: string[];
  /** `true` khi câu trả lời rơi đúng vào bẫy hiểu sai của nút. `null` khi chưa chấm được. */
  misconceptionHit: boolean | null;
  duDuLieu: boolean;
  /** Vì sao chưa chấm được, viết cho người học đọc. Rỗng khi đã chấm được. */
  lyDoChuaCham: string;
  /** Số giây người học ngồi gõ câu trả lời này. */
  thoiGianGiay: number;
}

export interface Statistics {
  totalSolved: number;
  totalCorrect: number;
  totalTimeSpent: number; // in seconds
  studyStreak: number;
  lastStudyDate?: string;
  accuracyByChapter: Record<number, { correct: number; total: number }>;
  accuracyByTopic: Record<string, { correct: number; total: number }>;
  incorrectQuestionHistory: Record<number, number>; // questionID -> wrong attempt count
  bookmarks: number[];
  flags: number[];
  conceptMastery?: Record<string, number>; // conceptID/conceptName -> mastery percentage (0-100)
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  fontSize: "sm" | "base" | "lg" | "xl";
  enableAnimations: boolean;
  enableTimer: boolean;
  enableSound: boolean;
  autoSaveProgress: boolean;
}

export interface AIRecommendation {
  id: string;
  date: string;
  weakChapters: number[];
  weakTopics: string[];
  recommendationText: string;
  suggestedAction: {
    type: "smart-exam" | "chapter-review" | "topic-review";
    chapterId?: number;
    topicId?: string;
    count: number;
  };
}

export interface DashboardOverview {
  subjectName: string;
  totalQuestions: number;
  totalChapters: number;
  totalTopics: number;
  completionRate: number; // percentage of questions solved at least once correctly
  progress: number; // overall progress percentage
  lastExam?: ExamAttempt;
}

/**
 * Mục tiêu của một môn.
 *
 * `targetScore` và `examDate` NHẬN `null`, và đó là điểm khác quan trọng nhất của kiểu này.
 * Chúng là hai KHẲNG ĐỊNH VỀ Ý ĐỊNH của người học, không phải thiết lập kỹ thuật, nên khi người
 * học chưa đặt thì không được bịa ra. Trước 13/08/2026 `getSubjectGoal` trả về hôm nay cộng 14
 * ngày và điểm 8,5, và màn Bàn học in ra "Còn 14 ngày tới kỳ thi ..., mục tiêu 8,5" trên hồ sơ
 * chưa từng đặt gì. Đó là bất biến 4.9 bị phá ngay ở tầng dữ liệu, chỗ mà mọi phép kiểm canh
 * tầng component không với tới.
 *
 * Từ 30/07/2026 nó nặng hơn một lỗi hiển thị. Bất biến 4.9i cho `learningEngine.scoreQuestions`
 * một yếu tố trọng số 0,15 chấm theo mức nhớ VÀO NGÀY THI, nên một ngày thi bịa sẽ điều khiển
 * thật việc chọn câu nào cho người học ôn.
 *
 * `dailyStudyMinutes` và `priority` GIỮ NGUYÊN không cho `null`: đó là thiết lập thói quen, có
 * mặc định hợp lý thì dùng được, không phải khẳng định về thực tế.
 */
export interface SubjectGoal {
  subjectId: string;
  targetScore: number | null; // null = người học chưa đặt
  examDate: string | null; // ISO date YYYY-MM-DD, null = người học chưa đặt
  dailyStudyMinutes: number; // e.g. 30, 45, 60, 90, 120
  priority: "High" | "Medium" | "Low";
  updatedAt: string;
}

export interface ExamPrediction {
  subjectId: string;
  predictedScore: number; // e.g. 8.1
  confidenceMargin: number; // e.g. 0.3 -> 8.1 ± 0.3
  confidenceLevel: "Cao" | "Trung bình" | "Cần thêm dữ liệu";
  /** `null` khi người học chưa đặt mục tiêu. Xem chú thích `SubjectGoal`. */
  targetScore: number | null;
  /** `null` khi chưa có mục tiêu để trừ ra. */
  gap: number | null; // targetScore - predictedScore
  /** Tỷ lệ điểm dự báo trên điểm mục tiêu. `null` khi chưa đặt mục tiêu. */
  readinessPercentage: number | null; // 0-100%
  metricsBreakdown: {
    masteryScore: number; // 0-100
    chapterCoverage: number; // 0-100
    conceptCoverage: number; // 0-100
    bloomDistributionScore: number; // 0-100
    learningVelocity: number; // qs/day
    retentionRate: number; // 0-100
    wrongQuestionRate: number; // 0-100
    mockExamAverage: number; // 0-10
    studyDebtCount: number;
    /** `null` khi người học chưa đặt ngày thi. Đừng thay bằng một con số mặc định. */
    remainingDays: number | null;
    stableMastery?: number;
    learningAcceleration?: number;
    urgencyIndex?: number;
    stageLabel?: string;
  };
  gapActionPlan: {
    id: string;
    title: string;
    type: "chapter" | "mastery" | "debt" | "mock";
    impact: number; // predicted score boost (+0.4)
    timeEstimateMinutes: number;
    completed: boolean;
    targetConcept?: string;
    unlockedConceptsCount?: number;
  }[];
  riskReport: {
    level: "Thấp" | "Trung bình" | "Cao";
    reasons: string[];
    mitigations: string[];
    multidimensionalRisk?: {
      knowledgeRisk: number;
      retentionRisk: number;
      timeRisk: number;
      coverageRisk: number;
      bloomRisk: number;
      consistencyRisk: number;
      fatigueRisk: number;
    };
  };
  explainability: {
    decision: string;
    reason: string;
    evidence: string;
    policy: string;
    timestamp: string;
    majorPositives?: string[];
    majorNegatives?: string[];
    uncertaintySource?: string;
    nextAction?: string;
  };
  calibration?: {
    rawPrediction: number;
    calibrationOffset: number;
    smoothedPrediction: number;
    historicalErrorAvg: number;
  };
  calibrationProfile?: ForecastCalibrationProfile;
  sensitivityAnalysis?: SensitivityItem[];
  uncertaintyDecomposition?: UncertaintyDecomposition;
  stressTestReport?: StressTestReport;
  pressureCurveStage?: string;
  adaptiveWeights?: {
    masteryWeight: number;
    retentionWeight: number;
    coverageWeight: number;
    bloomWeight: number;
    mockWeight: number;
    debtWeight: number;
  };
}

export interface ForecastCalibrationProfile {
  subjectId: string;
  overallBias: number; // e.g. -0.2 (system overestimates by 0.2)
  chapterBias: Record<number, number>;
  difficultyBias: Record<string, number>;
  bloomBias: Record<string, number>;
  examTypeBias: Record<string, number>;
  predictionVariance: number;
  calibrationCount: number;
  calibrationHistory: {
    timestamp: string;
    predictedScore: number;
    actualScore: number;
    bias: number;
    examType: string;
  }[];
}

export interface SensitivityItem {
  activityKey: string;
  activityLabel: string;
  additional30MinGain: number; // e.g. +0.43
  elasticityIndex: number;
  diminishingPhase: "HIGH_GAIN" | "MODERATE_GAIN" | "SATURATED";
  opportunityCostIfSkipped: number; // e.g. -0.42
}

export interface UncertaintyDecomposition {
  knowledgeUncertainty: number; // 0-1
  retentionUncertainty: number;
  coverageUncertainty: number;
  timeUncertainty: number;
  behaviorUncertainty: number;
  dependencyUncertainty: number;
  bloomUncertainty: number;
  overallConfidencePct: number; // e.g. 88%
  stabilityIndex: number; // 0-100
}

export interface StressTestReport {
  mostSensitiveVariable: string;
  mostEfficientAction: string;
  leastEfficientAction: string;
  criticalBottleneck: string;
  scenarios: {
    id: string;
    scenarioName: string;
    projectedScore: number;
    deltaFromBaseline: number;
    description: string;
  }[];
}

export interface StudyActivityROI {
  id: string;
  title: string;
  type: "wrong_notebook" | "adaptive_practice" | "mock_exam" | "chapter_review";
  durationMinutes: number;
  forecastPointGain: number; // e.g. +0.42
  roiValue: number; // gain per 10 mins
  // Có thêm mức "Thấp" từ 27/07/2026: hoạt động đã hết dư địa tăng điểm (ví dụ sổ tay câu sai
  // đang rỗng) phải nói thẳng là thấp, thay vì bị gán "Trung bình" cho đủ nhãn.
  priority: "Rất cao" | "Cao" | "Trung bình" | "Thấp";
  reason: string;
}

export interface StudyDebtItem {
  id: string;
  questionId?: number;
  conceptName: string;
  chapterId: number;
  topicId: string;
  debtType: "wrong_attempt" | "unlearned_chapter" | "low_bloom" | "overdue_review";
  priority: "Cao" | "Trung bình" | "Thấp";
  wrongCount: number;
  lastAttemptAt?: string;
  status: "pending" | "postponed" | "resolved";
}

export interface SessionItem {
  id: string;
  name: string;
  examType: string;
  subjectId: string;
  startTime: string;
  questionCount: number;
  score: number;
  timeSpent: number;
  status: "active" | "completed" | "archived";
}

export type ResourceType = "giáo trình" | "slide" | "đề cũ" | "flashcard" | "ghi chú" | "mindmap";

export interface LearningResource {
  id: string;
  title: string;
  type: ResourceType;
  status: "available" | "missing";
  conceptCount: number;
  updatedAt: string;
  fileSize?: string;
  url?: string;
}

export interface KnowledgeHealthItem {
  chapterId: number;
  chapterTitle: string;
  coveragePercentage: number;
  missingConcepts: string[];
  totalConcepts: number;
}

export interface KnowledgeVersion {
  version: string;
  date: string;
  addedConceptsCount: number;
  removedDuplicatesCount: number;
  coveragePercentage: number;
  description: string;
}

export interface LearningLogEntry {
  id: string;
  date: string;
  type: "Adaptive" | "Review" | "Mock Exam" | "Mastered" | "Retention";
  title: string;
  detail: string;
  score?: string;
}

export interface StudySnapshot {
  weekLabel: string;
  date: string;
  masteryPct: number;
  forecastScore: number;
  debtCount: number;
  solvedQuestions: number;
}

export interface AppSettings {
  focusMode: boolean;
  keyboardShortcuts: boolean;
  animations: boolean;
  autoSaveSession: boolean;
  soundEffects: boolean;
  dailyReminderTime: string;
}


