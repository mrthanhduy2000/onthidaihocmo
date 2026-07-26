export interface TeachingMetadata {
  learningObjective: string;
  misconception: string;
  teachingHint: string;
  memoryHook: string;
  realWorldExample: string;
  marketingExample?: string;
  counterExample?: string;
}

export interface ConceptDependency {
  requires: string[];
  requiredBy: string[];
  relatedConcepts: string[];
  oppositeConcepts: string[];
  confusedWith: string[];
}

export interface ReviewMetadata {
  reviewPriority: "high" | "medium" | "low";
  estimatedStudyMinutes: number;
  estimatedRetentionDifficulty: "easy" | "medium" | "hard";
  firstReviewDays: number;
  secondReviewDays: number;
  thirdReviewDays: number;
}

export interface ExplanationStrategy {
  simpleExplanation: string;
  mediumExplanation: string;
  expertExplanation: string;
  analogy: string;
  commonStudentQuestion: string;
  answerTemplate: string;
}

export interface QuestionGenMetadata {
  possibleQuestionTypes: ("definition" | "comparison" | "scenario" | "case_study" | "true_false" | "multiple_choice" | "reasoning" | "application")[];
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
    veryHard: number;
  };
}

export interface WrongAnswerCoaching {
  likelyReason: string;
  followUpQuestion: string;
  miniLesson: string;
  relatedConceptToReview: string;
}

export interface KnowledgeNode {
  id: string;
  chapter: number;
  topic: string;
  concept: string;
  definition: string;
  importance: number; // 1 to 5 stars
  source: string;
  page?: string;
  confidence: number; // 1 to 5
  type: "Definition" | "Process" | "Model" | "Classification" | "Comparison" | "Rule" | "Exception";
  details?: string;
  marketingApplication?: string;
  commonMistakes?: string;
  /**
   * Đúng khi nút này do `kbService` tổng hợp tự động cho môn không có đồ thị biên soạn tay.
   * Các nút đó có đủ trường chữ, nhưng toàn bộ là chuỗi mẫu ghép tên khái niệm vào, không phải
   * kiến thức do người soạn viết ra. Đừng dùng chúng làm bằng chứng học thuật.
   */
  laNutTongHop?: boolean;
  
  // Expanded Learning Engine Metadata
  teaching?: TeachingMetadata;
  dependencies?: ConceptDependency;
  review?: ReviewMetadata;
  explanation?: ExplanationStrategy;
  questionGen?: QuestionGenMetadata;
  coaching?: WrongAnswerCoaching;
}

export interface ConceptLink {
  sourceId: string;
  targetId: string;
  relationship: string;
  description: string;
}

export interface ExamPattern {
  topic: string;
  frequency: "High" | "Medium" | "Low";
  bloomLevel: "Remember" | "Understand" | "Apply" | "Analyze";
  questionType: "Multiple Choice" | "Scenario" | "True/False";
  trapDescription: string;
}

export interface DistractorItem {
  conceptId: string;
  correctAnswer: string;
  distractor: string;
  reason: string;
}

export interface BlueprintItem {
  id: string;
  concept: string;
  testedAngles: {
    angle: string;
    difficulty: "Easy" | "Medium" | "Hard" | "Very Hard";
    examplePrompt: string;
  }[];
}

export interface AdaptiveMetadata {
  conceptId: string;
  prerequisites: string[];
  dependencies: string[];
  recommendedReviewIntervalDays: number;
}

export const cbKnowledgeGraph: KnowledgeNode[] = [
  // Chương 1
  {
    id: "CB_C1_N1",
    chapter: 1,
    topic: "CB_T1.1",
    concept: "Hành vi khách hàng (Consumer Behavior)",
    definition: "Là toàn bộ những hoạt động liên quan trực tiếp đến việc mua sắm, sử dụng và xử lý các sản phẩm, dịch vụ bao gồm các quyết định trước, trong và sau các hoạt động này.",
    importance: 5,
    source: "Giáo trình Lê Phúc Loan & Nguyễn Thị Bích Trâm (2022), Đề thi mẫu",
    page: "Câu 17",
    confidence: 5,
    type: "Definition",
    details: "Hành vi khách hàng bao gồm cả khách hàng cá nhân (B2C) và khách hàng tổ chức (B2B). Ba nhóm hoạt động cốt lõi là: Mua sắm (Acquisition), Sử dụng (Consumption/Usage), và Xử lý (Disposal) sản phẩm dịch vụ.",
    marketingApplication: "Xác định điểm chạm (touchpoints) trong hành trình trải nghiệm sản phẩm để tác động truyền thông.",
    commonMistakes: "Học sinh dễ nhầm lẫn rằng hành vi khách hàng chỉ bao gồm hành động 'mua sắm' (Acquisition) mà quên đi khía cạnh 'sử dụng' (Usage) và 'xử lý' (Disposal).",
    
    teaching: {
      learningObjective: "Giải thích rõ ràng và toàn vẹn ba khía cạnh cấu thành hành vi khách hàng và phân biệt được sự khác nhau giữa khách hàng cá nhân và tổ chức.",
      misconception: "Cho rằng hành vi khách hàng chỉ giới hạn ở việc ra quyết định trả tiền và cầm sản phẩm ra về.",
      teachingHint: "Bắt đầu bằng việc thảo luận điều gì xảy ra sau khi một sản phẩm được mua (ví dụ: việc vứt bỏ pin cũ hay tái chế chai nhựa ảnh hưởng thế nào đến môi trường và quyết định tái mua).",
      memoryHook: "HVKH = 3U (Mua sắm - Sử dụng - Xử lý)",
      realWorldExample: "Người tiêu dùng mua một chiếc iPhone (Mua sắm), tải ứng dụng và sạc pin hàng ngày (Sử dụng), sau đó bán lại máy cũ khi nâng cấp máy mới (Xử lý).",
      marketingExample: "Một hãng sữa phát triển chương trình thu hồi vỏ hộp giấy để bảo vệ môi trường, tác động trực tiếp vào khâu 'Xử lý' trong hành vi khách hàng.",
      counterExample: "Sự sụt giảm doanh số bán hàng do khủng hoảng kinh tế vĩ mô là một chỉ số tài chính, không phải là một mô tả trực tiếp về hoạt động hành vi khách hàng."
    },
    dependencies: {
      requires: [],
      requiredBy: ["CB_C5_N1"],
      relatedConcepts: ["CB_C6_N1"],
      oppositeConcepts: [],
      confusedWith: ["Hành vi mua sắm đơn thuần"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "easy",
      firstReviewDays: 1,
      secondReviewDays: 7,
      thirdReviewDays: 30
    },
    explanation: {
      simpleExplanation: "Hành vi khách hàng là tất cả những gì một người làm trước, trong và sau khi mua một món đồ, từ lúc thèm muốn, tìm mua, sử dụng cho đến khi vứt nó đi.",
      mediumExplanation: "Hành vi khách hàng không chỉ là khoảnh khắc mua hàng mà là một chuỗi hành động khép kín gồm mua sắm, tiêu thụ và thải bỏ, bị chi phối bởi các yếu tố nội tại và ngoại cảnh.",
      expertExplanation: "Nghiên cứu hành vi khách hàng là bộ môn khoa học hành vi liên ngành, khảo sát các tiến trình lựa chọn, mua sắm, sử dụng và đào thải sản phẩm/dịch vụ/ý tưởng của cá nhân hoặc tổ chức nhằm thỏa mãn nhu cầu.",
      analogy: "Hành vi khách hàng giống như việc xem một bộ phim dài tập: mua hàng chỉ là phần mở bài, xem phim là thân bài, và chia sẻ cảm nhận hay cất dĩa phim đi là kết bài.",
      commonStudentQuestion: "Tại sao khâu 'xử lý' sản phẩm cũng được xem là hành vi khách hàng?",
      answerTemplate: "Vì cách khách hàng đào thải hoặc tái sử dụng sản phẩm sẽ quyết định trực tiếp việc họ có quay lại mua sản phẩm mới hay không, đồng thời tạo ra cơ hội marketing xanh cho doanh nghiệp."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "true_false", "application"],
      difficultyDistribution: { easy: 60, medium: 30, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh thường bị bẫy bởi câu trả lời chỉ nhấn mạnh hoạt động mua sắm hoặc trả tiền.",
      followUpQuestion: "Hãy nghĩ xem khi một chiếc tủ lạnh bị hỏng, việc người dùng vứt bỏ hay đem đi sửa có tác động thế nào đến doanh nghiệp?",
      miniLesson: "Hành vi khách hàng là một tiến trình liên tục, gồm: Mua sắm (Acquisition), Sử dụng (Usage), và Xử lý (Disposal). Cả 3 khâu đều thuộc phạm vi nghiên cứu.",
      relatedConceptToReview: "CB_C5_N1"
    }
  },
  {
    id: "CB_C1_N2",
    chapter: 1,
    topic: "CB_T1.2",
    concept: "Mối quan hệ HVKH với 4Ps",
    definition: "Sự thấu hiểu hành vi khách hàng là nền tảng cốt lõi để xây dựng chiến lược marketing hỗn hợp (Sản phẩm, Giá, Phân phối, Chiêu thị) thích ứng với nhu cầu thị trường.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 18, 19, 20",
    confidence: 5,
    type: "Rule",
    details: "Đối với chiến lược sản phẩm, nghiên cứu giúp đưa ra các sản phẩm nhiều 'tiện ích' phù hợp thị hiếu. Đối với chiêu thị, giúp chọn đúng 'phương tiện truyền thông' thu hút thuyết phục khách hàng. Khách hàng là đối tượng thừa hưởng các đặc tính chất lượng của sản phẩm hoặc 'dịch vụ'.",
    marketingApplication: "Định vị hình tượng thương hiệu phù hợp với tính cách của tập khách hàng mục tiêu.",
    commonMistakes: "Nhầm lẫn giữa mục tiêu nội bộ doanh nghiệp (như quy trình quản lý nội bộ) với các chiến lược marketing hướng ngoại (như thông điệp quảng cáo, hình tượng sản phẩm) chịu chi phối bởi tính cách khách hàng.",
    
    teaching: {
      learningObjective: "Vận dụng hiểu biết về đặc điểm khách hàng để liên kết và thiết kế các chính sách marketing 4P tương ứng.",
      misconception: "Nghĩ rằng 4P được quyết định hoàn toàn bởi chi phí sản xuất và mong muốn chủ quan của giám đốc doanh nghiệp.",
      teachingHint: "Hãy hỏi sinh viên: Nếu khách hàng của bạn là những người cực kỳ bận rộn và coi trọng thời gian, bạn nên thay đổi P nào trong 4P? (Gợi ý: Phân phối tiện lợi và Sản phẩm ăn liền).",
      memoryHook: "HVKH làm gương cho 4Ps soi bóng.",
      realWorldExample: "Thấy khách hàng gen Z thích xem video ngắn dưới 1 phút (HVKH), các nhãn hàng lập tức chuyển ngân sách quảng cáo sang TikTok (Chiêu thị - Promotion).",
      marketingExample: "Apple thiết kế các sản phẩm tối giản, sang trọng vì họ thấu hiểu nhóm khách hàng mục tiêu coi trọng sự sành điệu và tinh tế (Sản phẩm - Product).",
      counterExample: "Sự thay đổi về thuế thu nhập doanh nghiệp của nhà nước ảnh hưởng đến giá bán là yếu tố pháp lý vĩ mô, không trực tiếp bắt nguồn từ thấu hiểu hành vi khách hàng."
    },
    dependencies: {
      requires: ["CB_C1_N1"],
      requiredBy: [],
      relatedConcepts: ["CB_C3_N1"],
      oppositeConcepts: [],
      confusedWith: ["Chiến lược tài chính", "Quy trình nội bộ"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 12,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 2,
      secondReviewDays: 10,
      thirdReviewDays: 45
    },
    explanation: {
      simpleExplanation: "Hiểu khách hàng muốn gì thì doanh nghiệp mới biết cách làm ra sản phẩm có ích (Product), đặt giá hợp lý (Price), bán ở nơi tiện lợi (Place), và quảng cáo đúng cách (Promotion).",
      mediumExplanation: "4Ps là công cụ của doanh nghiệp, nhưng hành vi khách hàng là chiếc la bàn. Doanh nghiệp nghiên cứu thói quen và tâm lý khách hàng để tinh chỉnh từng chữ P sao cho khớp với mong muốn của họ nhất.",
      expertExplanation: "Mối quan hệ này là một chuỗi phản hồi động. Các nghiên cứu định lượng và định tính về nhân khẩu học, tâm lý và hành vi khách hàng là cơ sở tiền đề để tối ưu hóa phối thức tiếp thị hỗn hợp (marketing mix), tối đa hóa giá trị vòng đời khách hàng.",
      analogy: "Mối quan hệ này giống như việc thợ may (doanh nghiệp) phải đo kích thước cơ thể của khách hàng (HVKH) rồi mới cắt vải để may ra bộ quần áo vừa vặn (4Ps).",
      commonStudentQuestion: "Tính cách của khách hàng ảnh hưởng thế nào đến 4Ps của doanh nghiệp?",
      answerTemplate: "Tính cách của khách hàng quyết định trực tiếp đến thông điệp quảng cáo (Promotion) và hình tượng sản phẩm (Product) của công ty để tạo ra sự đồng điệu tâm lý."
    },
    questionGen: {
      possibleQuestionTypes: ["comparison", "multiple_choice", "application"],
      difficultyDistribution: { easy: 40, medium: 50, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh chọn nhầm phương án liên quan đến quản lý nội bộ khi được hỏi về tác động của tính cách khách hàng.",
      followUpQuestion: "Nếu một khách hàng có tính cách hướng ngoại, họ sẽ phản ứng tốt hơn với quảng cáo sôi động hay quy trình họp nội bộ của phòng kế toán công ty?",
      miniLesson: "Tính cách khách hàng ảnh hưởng đến các điểm chạm bên ngoài như thông điệp quảng cáo và hình ảnh thương hiệu, tuyệt đối không can thiệp vào quy trình quản lý nội bộ nội bộ của doanh nghiệp.",
      relatedConceptToReview: "CB_C3_N1"
    }
  },

  // Chương 2
  {
    id: "CB_C2_N1",
    chapter: 2,
    topic: "CB_T2.1",
    concept: "Nhánh văn hóa (Subculture)",
    definition: "Là một nhóm văn hóa có thể nhận dạng được tồn tại như một phân đoạn nhỏ trong một xã hội lớn và phức tạp hơn, chia sẻ các giá trị, niềm tin và phong tục đặc thù.",
    importance: 5,
    source: "Đề thi mẫu",
    page: "Câu 11, 13",
    confidence: 5,
    type: "Classification",
    details: "Nhánh văn hóa có đặc tính 'năng động và phát triển' theo thời gian chứ không phải bền vững tĩnh tại. Các nhánh văn hóa phổ biến bao gồm tôn giáo, dân tộc, quốc gia, chủng tộc, vùng miền.",
    marketingApplication: "Phục vụ các sản phẩm tôn giáo đặc thù, ví dụ chứng nhận HALAL cho thực phẩm dành cho nhánh văn hóa tôn giáo (người Hồi giáo).",
    commonMistakes: "Nghĩ rằng nhánh văn hóa là tĩnh, không thay đổi hoặc hoàn toàn biệt lập/loại trừ lẫn nhau với văn hóa thống trị.",
    
    teaching: {
      learningObjective: "Nhận diện các đặc điểm của nhánh văn hóa và đề xuất sản phẩm/dịch vụ phù hợp cho từng phân khúc nhánh văn hóa cụ thể.",
      misconception: "Nghĩ rằng nhánh văn hóa là các nhóm người lỗi thời, bảo thủ và không bao giờ tiếp nhận xu hướng mới.",
      teachingHint: "Nhấn mạnh từ 'năng động và phát triển'. Cho học sinh thảo luận về cách nhánh văn hóa của người trẻ tuổi (subculture of youth) liên tục tạo ra các từ lóng mới và phong cách thời trang thay đổi theo tháng.",
      memoryHook: "Nhánh văn hóa = Năng động & Chia sẻ",
      realWorldExample: "Cộng đồng người Chăm ở Ninh Thuận có những phong tục, lễ hội Katê riêng biệt nhưng vẫn là một phần của văn hóa Việt Nam thống trị.",
      marketingExample: "Các nhà sản xuất thực phẩm xuất khẩu sang Trung Đông bắt buộc phải có chứng nhận HALAL để đáp ứng nhu cầu khắt khe của nhánh văn hóa tôn giáo Hồi giáo.",
      counterExample: "Sở thích cá nhân của một người thích chơi game một mình không tạo thành một nhánh văn hóa nếu không có một cộng đồng chia sẻ các giá trị và chuẩn mực xã hội chung."
    },
    dependencies: {
      requires: [],
      requiredBy: [],
      relatedConcepts: ["CB_C6_N2"],
      oppositeConcepts: ["Văn hóa thống trị (Dominant culture)"],
      confusedWith: ["Tầng lớp xã hội"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 15,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 1,
      secondReviewDays: 5,
      thirdReviewDays: 20
    },
    explanation: {
      simpleExplanation: "Nhánh văn hóa là những nhóm nhỏ trong xã hội có chung một số đặc tính đặc biệt như cùng tôn giáo, cùng miền quê, hoặc cùng sắc tộc, và họ có thói quen tiêu dùng rất giống nhau.",
      mediumExplanation: "Nhánh văn hóa là những phân khúc nhỏ của nền văn hóa lớn hơn. Các thành viên trong nhánh văn hóa vừa tuân thủ các giá trị cốt lõi của quốc gia, vừa sở hữu các niềm tin, chuẩn mực ứng xử riêng biệt. Nhánh văn hóa luôn năng động và phát triển chứ không đứng yên.",
      expertExplanation: "Nhánh văn hóa (Subculture) là các cấu trúc xã hội trung vi mô, vận hành song song và tương tác với nền văn hóa thống trị. Chúng liên tục tái định hình giá trị thông qua giao thoa thế hệ và toàn cầu hóa, đòi hỏi các marketer phải bản địa hóa thông điệp.",
      analogy: "Nếu cả cây đại thụ là nền văn hóa lớn của một đất nước, thì những nhánh cây đâm ra các hướng khác nhau chính là các nhánh văn hóa. Chúng có chung gốc rễ nhưng mỗi nhánh hướng về một góc trời riêng.",
      commonStudentQuestion: "Tại sao nói nhánh văn hóa năng động và phát triển?",
      answerTemplate: "Vì các giá trị, hành vi tiêu dùng và ranh giới của nhánh văn hóa không cố định mà luôn biến đổi, thích nghi dưới sự tác động của công nghệ, di cư và trao đổi thông tin."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "true_false", "application"],
      difficultyDistribution: { easy: 50, medium: 40, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Sinh viên chọn đáp án nói rằng nhánh văn hóa là 'bền vững và không thay đổi' do thói quen nghĩ về văn hóa như một thứ cố định cổ xưa.",
      followUpQuestion: "Trào lưu nhạc Rap vốn xuất phát từ nhánh văn hóa đường phố, giờ đây đã trở thành một ngành công nghiệp khổng lồ. Điều này chứng tỏ nhánh văn hóa có thay đổi không?",
      miniLesson: "Văn hóa và nhánh văn hóa luôn có tính động (dynamic), luôn phát triển và thích nghi với thời đại. Phương án đúng phải là 'năng động và phát triển'.",
      relatedConceptToReview: "CB_C2_N1"
    }
  },
  {
    id: "CB_C2_N2",
    chapter: 2,
    topic: "CB_T2.2",
    concept: "Dịch chuyển xã hội (Social Mobility)",
    definition: "Là khả năng một cá nhân hoặc gia đình di chuyển từ tầng lớp xã hội này sang tầng lớp xã hội khác trong hệ thống phân tầng xã hội.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 16",
    confidence: 5,
    type: "Definition",
    details: "Có thể là dịch chuyển đi lên (upward), đi xuống (downward) hoặc dịch chuyển ngang (horizontal). Việc đo lường tầng lớp xã hội dựa trên nghề nghiệp, học vấn, tài sản và thu nhập.",
    marketingApplication: "Dự báo sự thay đổi trong hành vi tiêu dùng xa xỉ khi có sự gia tăng tầng lớp trung lưu.",
    commonMistakes: "Dễ nhầm thuật ngữ dịch chuyển xã hội (social mobility) với phân cấp địa vị hoặc phân tầng xã hội.",
    
    teaching: {
      learningObjective: "Định nghĩa dịch chuyển xã hội và phân tích được ảnh hưởng của nó tới cấu trúc tiêu dùng của các nhóm sản phẩm cao cấp.",
      misconception: "Nghĩ rằng xã hội phong kiến hay hiện đại đều không có sự thay đổi tầng lớp và ai sinh ra ở đâu sẽ ở yên đó mãi mãi.",
      teachingHint: "Liên hệ trực tiếp với học vấn. Một người xuất thân nông thôn đỗ đại học và trở thành kỹ sư công nghệ cao là ví dụ kinh điển của việc dịch chuyển đi lên.",
      memoryHook: "Dịch chuyển = Di chuyển tầng lớp",
      realWorldExample: "Một công nhân tự học thành lập công ty, trở thành doanh nhân thành đạt và chuyển vào khu biệt thự cao cấp sống.",
      marketingExample: "Thế giới di động định vị chuỗi cửa hàng cao cấp để đón đầu làn sóng dịch chuyển đi lên của nhóm người tiêu dùng có thu nhập cải thiện nhanh chóng.",
      counterExample: "Việc một người chuyển chỗ ở từ quận này sang quận khác cùng thành phố mà không thay đổi nghề nghiệp hay thu nhập chỉ là dịch cư địa lý, không phải dịch chuyển xã hội."
    },
    dependencies: {
      requires: [],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: ["Đóng băng giai cấp"],
      confusedWith: ["Phân tầng xã hội", "Phân cấp địa vị"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 3,
      secondReviewDays: 14,
      thirdReviewDays: 60
    },
    explanation: {
      simpleExplanation: "Dịch chuyển xã hội là việc một người thay đổi địa vị từ nghèo lên giàu (hoặc ngược lại) nhờ vào nỗ lực học tập, công việc hoặc may mắn.",
      mediumExplanation: "Dịch chuyển xã hội thể hiện mức độ linh hoạt của một nền kinh tế. Khi xã hội có độ dịch chuyển cao, người tiêu dùng có xu hướng mua sắm các sản phẩm thể hiện địa vị mới của mình để tự khẳng định.",
      expertExplanation: "Dịch chuyển xã hội (Social Mobility) là chỉ số đo lường sự thay đổi địa vị giai tầng xã hội của các cá nhân hoặc nhóm xã hội theo thời gian. Sự chuyển dịch này trực tiếp tái cấu trúc rổ hàng hóa tiêu dùng và định hình lại các chuẩn mực tiêu dùng biểu trưng (symbolic consumption).",
      analogy: "Dịch chuyển xã hội giống như việc đi thang máy giữa các tầng của một tòa nhà xã hội: bạn có thể đi lên tầng thượng sang trọng hoặc đi xuống tầng hầm.",
      commonStudentQuestion: "Dịch chuyển xã hội khác gì với phân tầng xã hội?",
      answerTemplate: "Phân tầng xã hội là việc chia xã hội thành các tầng lớp cố định như bậc thang. Còn dịch chuyển xã hội là hành động bước đi lên xuống giữa các bậc thang đó."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "true_false"],
      difficultyDistribution: { easy: 70, medium: 20, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Sinh viên thường nhầm lẫn giữa cấu trúc tĩnh (phân tầng xã hội) và sự vận động (dịch chuyển xã hội).",
      followUpQuestion: "Khi một người thăng tiến từ nhân viên văn phòng bình thường lên tổng giám đốc, cấu trúc xã hội thay đổi hay địa vị của cá nhân đó thay đổi?",
      miniLesson: "Khả năng chuyển từ tầng lớp này sang tầng lớp khác được gọi là 'Dịch chuyển xã hội'. Hãy chú ý từ khóa 'chuyển từ... sang...'.",
      relatedConceptToReview: "CB_C2_N2"
    }
  },
  {
    id: "CB_C2_N3",
    chapter: 2,
    topic: "CB_T2.2",
    concept: "Vòng đời gia đình (Family Life Cycle)",
    definition: "Là mô hình phân loại mô tả sự phát triển của gia đình qua các giai đoạn dựa trên sự kết hợp của nhiều biến số nhân khẩu học.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 14",
    confidence: 5,
    type: "Model",
    details: "Các biến số kết hợp cấu thành bao gồm: Quy mô gia đình (family size), tình trạng hôn nhân (marital status), và tuổi của các thành viên trong gia đình (age of members).",
    marketingApplication: "Định vị sản phẩm theo nhu cầu tiêu dùng đặc thù của từng giai đoạn (ví dụ: vợ chồng mới cưới, nuôi con nhỏ, tổ ấm trống trải).",
    commonMistakes: "Nhầm lẫn 'Thu nhập gia đình' là một biến số trực tiếp kết hợp tạo ra mô hình vòng đời gia đình (trong mô hình chuẩn, thu nhập là biến số độc lập ảnh hưởng sức mua chứ không định hình giai đoạn vòng đời).",
    
    teaching: {
      learningObjective: "Liệt kê đúng các biến số tạo nên vòng đời gia đình và thiết kế thông điệp truyền thông thích ứng với các giai đoạn của vòng đời gia đình.",
      misconception: "Nghĩ rằng thu nhập gia đình quyết định giai đoạn của vòng đời gia đình (ví dụ: giàu thì ở giai đoạn khác, nghèo ở giai đoạn khác).",
      teachingHint: "Hỏi học sinh: Một cặp vợ chồng 60 tuổi giàu có và một cặp vợ chồng 60 tuổi nghèo có điểm chung gì về mặt cấu trúc gia đình? (Gợi ý: con cái đều đã lớn và ra ở riêng - giai đoạn tổ ấm trống trải). Do đó, tuổi và quy mô gia đình là biến số chính, không phải thu nhập.",
      memoryHook: "Vòng đời gia đình = Tuổi + Hôn nhân + Quy mô",
      realWorldExample: "Cặp đôi mới cưới mua căn hộ nhỏ; khi có con mua sữa, bỉm; khi con đi học mua sách vở; khi con ra ở riêng bố mẹ lại mua thực phẩm bảo vệ sức khỏe dưỡng già.",
      marketingExample: "Các khu nghỉ dưỡng thiết kế gói du lịch 'Trăng mật' cho cặp đôi mới cưới và gói 'Đại gia đình' cho các gia đình có cả con nhỏ lẫn ông bà.",
      counterExample: "Thu nhập hàng tháng tăng từ 15 triệu lên 30 triệu không làm gia đình chuyển sang giai đoạn vòng đời mới nếu họ vẫn là cặp vợ chồng chưa có con."
    },
    dependencies: {
      requires: [],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: [],
      confusedWith: ["Thu nhập gia đình", "Chu kỳ sống của sản phẩm"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 3,
      secondReviewDays: 14,
      thirdReviewDays: 60
    },
    explanation: {
      simpleExplanation: "Vòng đời gia đình là các bước đi của một tổ ấm từ lúc hai người trẻ kết hôn, sinh con, nuôi con lớn khôn, cho đến khi con cái ra ở riêng và hai ông bà già nương tựa nhau.",
      mediumExplanation: "Vòng đời gia đình là một mô hình nhân khẩu học kết hợp giữa tuổi tác, hôn nhân và quy mô gia đình để dự báo nhu cầu mua sắm. Mỗi giai đoạn có một danh mục sản phẩm ưu tiên hoàn toàn khác nhau.",
      expertExplanation: "Mô hình Vòng đời gia đình (Family Life Cycle) tích hợp các biến số nhân khẩu học cốt lõi nhằm xác định các phân đoạn tiêu dùng hộ gia đình. Nghiên cứu mô hình này cho phép doanh nghiệp tối ưu hóa vòng đời sản phẩm tương thích với sự tiến hóa nhu cầu của hộ gia đình.",
      analogy: "Vòng đời gia đình giống như một vở kịch nhiều chương: Chương 1 là Độc thân, Chương 2 là Đám cưới, Chương 3 là Làm cha mẹ, và Chương kết là Tổ ấm trống trải.",
      commonStudentQuestion: "Tại sao thu nhập không nằm trong các biến tạo ra vòng đời gia đình?",
      answerTemplate: "Vì thu nhập chỉ quyết định khả năng chi trả (mua đồ hiệu hay đồ bình dân), còn nhu cầu thực tế về loại sản phẩm (ví dụ: bỉm sữa khi có con nhỏ) là do giai đoạn vòng đời quyết định."
    },
    questionGen: {
      possibleQuestionTypes: ["multiple_choice", "true_false", "application"],
      difficultyDistribution: { easy: 60, medium: 30, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Sinh viên chọn phương án có chứa 'Thu nhập gia đình' vì mặc định thu nhập là yếu tố quan trọng nhất trong mọi hành vi mua.",
      followUpQuestion: "Nếu một gia đình trung lưu và một gia đình siêu giàu đều có em bé mới sinh, loại sản phẩm cơ bản họ phải tìm kiếm có giống nhau không?",
      miniLesson: "Vòng đời gia đình được tạo ra bởi: tuổi thành viên, quy mô gia đình, và tình trạng hôn nhân. Thu nhập gia đình không phải là biến số kết hợp để định hình giai đoạn vòng đời.",
      relatedConceptToReview: "CB_C2_N3"
    }
  },
  {
    id: "CB_C2_N4",
    chapter: 2,
    topic: "CB_T2.2",
    concept: "Quyền lực xã hội trong nhóm tham khảo (Social Power)",
    definition: "Sức mạnh ảnh hưởng của nhóm tham khảo hoặc một cá nhân lên hành vi, suy nghĩ và quyết định của người tiêu dùng.",
    importance: 5,
    source: "Đề thi mẫu",
    page: "Câu 12, 15",
    confidence: 5,
    type: "Classification",
    details: "Gồm nhiều loại quyền lực: Quyền lực tham chiếu (Referent power) xuất hiện khi người tiêu dùng ngưỡng mộ phẩm chất của người khác và sao chép hành vi của họ; Quyền lực chuyên gia (Expert power) xuất phát từ kiến thức chuyên sâu sở hữu về một lĩnh vực nội dung.",
    marketingApplication: "Sử dụng KOL/KOC có chuyên môn cao (Expert power) hoặc người nổi tiếng được ngưỡng mộ (Referent power) để quảng bá sản phẩm.",
    commonMistakes: "Lẫn lộn giữa quyền lực tham chiếu (sao chép vì ngưỡng mộ phong cách) và quyền lực chuyên gia (tin tưởng vì kiến thức chuyên môn).",
    
    teaching: {
      learningObjective: "Phân biệt các loại quyền lực xã hội trong nhóm tham khảo và ứng dụng đúng loại quyền lực khi thuê người nổi tiếng/KOL quảng cáo.",
      misconception: "Nghĩ rằng chỉ những người có địa vị chính trị hoặc pháp luật mới có quyền lực ảnh hưởng đến hành vi mua sắm của người khác.",
      teachingHint: "Hỏi sinh viên: Tại sao bạn lại mua kiểu áo giống hệt idol Hàn Quốc mặc? Họ có bắt bạn mua hay phạt bạn không? (Gợi ý: Không, đó là do bạn ngưỡng mộ họ - Quyền lực tham chiếu).",
      memoryHook: "Tham chiếu = Ngưỡng mộ sao chép; Chuyên gia = Kiến thức chuyên sâu",
      realWorldExample: "Một bác sĩ khuyên dùng loại kem đánh răng đặc trị (Quyền lực chuyên gia); một ca sĩ nổi tiếng đeo kính râm hiệu Gucci khiến fan lùng sục mua theo (Quyền lực tham chiếu).",
      marketingExample: "Hãng mỹ phẩm thuê Beauty Blogger có bằng cấp hóa mỹ phẩm để review chất lượng thành phần (Quyền lực chuyên gia) đồng thời thuê hoa hậu làm đại sứ thương hiệu (Quyền lực tham chiếu).",
      counterExample: "Cảnh sát phạt tiền người không đội mũ bảo hiểm là quyền lực pháp lý/cưỡng chế của nhà nước, không phải là tác động từ nhóm tham khảo tiêu dùng tự nguyện."
    },
    dependencies: {
      requires: [],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: [],
      confusedWith: ["Quyền lực cưỡng chế", "Quyền lực pháp luật"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 15,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 1,
      secondReviewDays: 5,
      thirdReviewDays: 21
    },
    explanation: {
      simpleExplanation: "Quyền lực xã hội là sức mạnh của một người hay nhóm người khiến bạn muốn nghe theo lời khuyên của họ hoặc muốn bắt chước phong cách sống của họ.",
      mediumExplanation: "Nhóm tham khảo ảnh hưởng đến chúng ta qua các loại quyền lực xã hội. Quyền lực tham chiếu bắt nguồn từ sự ngưỡng mộ và khao khát đồng nhất hóa bản thân với hình mẫu. Quyền lực chuyên gia dựa trên sự tin tưởng vào kiến thức và trình độ chuyên môn của họ.",
      expertExplanation: "Quyền lực xã hội (Social Power) định vị khả năng điều chỉnh hành vi của chủ thể (người tiêu dùng) phù hợp với kỳ vọng của tác nhân tác động. Việc khai thác các dạng quyền lực này là mấu chốt để thiết lập sự tin cậy và thúc đẩy chuyển đổi thông qua kênh truyền thông xã hội.",
      analogy: "Quyền lực chuyên gia giống như chiếc bản đồ chỉ đường của người dẫn đường chuyên nghiệp. Quyền lực tham chiếu giống như thỏi nam châm hút bạn đi theo vì bạn thấy người đó quá quyến rũ.",
      commonStudentQuestion: "Làm sao phân biệt nhanh quyền lực tham chiếu và quyền lực chuyên gia?",
      answerTemplate: "Hãy tự hỏi: Bạn làm theo vì muốn 'được giống như họ' (Tham chiếu) hay vì bạn tin họ 'nói rất đúng khoa học' (Chuyên gia)?"
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "application"],
      difficultyDistribution: { easy: 40, medium: 40, hard: 20, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Sinh viên dễ chọn sai khi tình huống mô tả việc sao chép phong cách của thần tượng nhưng lại chọn quyền lực thông tin hoặc chuyên gia.",
      followUpQuestion: "Nếu bạn mặc một chiếc áo giống Sơn Tùng M-TP, đó là vì Sơn Tùng dạy bạn cách dệt vải (Chuyên gia) hay vì bạn ngưỡng mộ phong cách của anh ấy (Tham chiếu)?",
      miniLesson: "Ngưỡng mộ phẩm chất và sao chép hành vi luôn chỉ ra 'Quyền lực tham chiếu'. Còn kiến thức chuyên sâu sở hữu về một lĩnh vực là nguồn gốc của 'Quyền lực chuyên gia'.",
      relatedConceptToReview: "CB_C2_N4"
    }
  },

  // Chương 3
  {
    id: "CB_C3_N1",
    chapter: 3,
    topic: "CB_T3.2",
    concept: "Tính cách (Personality)",
    definition: "Những đặc điểm tâm lý nội tại bền vững quyết định cách thức ứng xử nhất quán của một cá nhân trong những tình huống khác nhau của môi trường.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 3, 5",
    confidence: 5,
    type: "Rule",
    details: "Tính cách mang tính bền vững cao. Tính cách của nhóm khách hàng sẽ trực tiếp quyết định thông điệp quảng cáo, hình tượng sản phẩm và chiến lược marketing của công ty, nhưng KHÔNG quyết định quy trình quản lý nội bộ của doanh nghiệp.",
    marketingApplication: "Thiết kế cá tính thương hiệu (Brand Personality) tương thích với tính cách của phân khúc mục tiêu.",
    commonMistakes: "Nghĩ rằng tính cách thay đổi liên tục theo tình huống ngắn hạn hoặc quyết định cả cấu trúc tổ chức vận hành nội bộ của doanh nghiệp đối tác.",
    
    teaching: {
      learningObjective: "Định nghĩa tính cách, hiểu rõ thuộc tính bền vững của nó và phân tích được tại sao tính cách không can thiệp vào vận hành nội bộ của doanh nghiệp.",
      misconception: "Nghĩ rằng một người hướng ngoại hôm nay có thể lập tức biến thành người hướng nội hoàn toàn vào ngày mai tùy thuộc vào món đồ họ mua.",
      teachingHint: "Nhấn mạnh từ 'nội tại bền vững'. Đưa ra ví dụ về một người cẩn thận, chi tiết sẽ luôn đọc kỹ nhãn mác sản phẩm trước khi mua, bất kể là mua sữa hay mua ô tô.",
      memoryHook: "Tính cách = Nội tại + Bền vững",
      realWorldExample: "Người có tính cách mạo hiểm, thích thử thách thường chọn chơi các môn thể thao cảm giác mạnh và mua các dòng xe SUV hầm hố.",
      marketingExample: "Hãng Red Bull xây dựng hình ảnh thương hiệu liều lĩnh, bứt phá giới hạn để thu hút những người tiêu dùng có tính cách năng động, ưa mạo hiểm.",
      counterExample: "Sổ tay quy định nhân viên phải chấm công bằng vân tay lúc 8h sáng là quy trình quản lý nội bộ doanh nghiệp, không chịu ảnh hưởng bởi tính cách của khách hàng mua lẻ."
    },
    dependencies: {
      requires: [],
      requiredBy: ["CB_C1_N2"],
      relatedConcepts: ["CB_C3_N2"],
      oppositeConcepts: [],
      confusedWith: ["Lối sống", "Tâm trạng nhất thời"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "easy",
      firstReviewDays: 2,
      secondReviewDays: 7,
      thirdReviewDays: 30
    },
    explanation: {
      simpleExplanation: "Tính cách là những nét đặc trưng sâu bên trong một người, rất khó thay đổi, quyết định cách người đó suy nghĩ và hành động trong cuộc sống.",
      mediumExplanation: "Tính cách là tập hợp các đặc điểm tâm lý bền vững giúp cá nhân phản ứng một cách nhất quán với môi trường xung quanh. Marketer dựa vào tính cách khách hàng để thiết kế thông điệp quảng cáo phù hợp, nhưng tính cách này không can thiệp vào quy trình kỹ thuật nội bộ của hãng.",
      expertExplanation: "Tính cách (Personality) cấu thành từ các thuộc tính tâm lý nội tại có độ ổn định cao qua thời gian và không gian. Đo lường tính cách qua các mô hình như Big Five giúp định vị thông điệp chiêu thị tối ưu tâm lý cá nhân hóa.",
      analogy: "Tính cách giống như hệ điều hành của máy tính: nó chạy ngầm bên dưới, rất khó thay đổi và điều khiển cách máy tính xử lý mọi ứng dụng.",
      commonStudentQuestion: "Tại sao tính cách của nhóm khách hàng không quyết định quy trình quản lý nội bộ của công ty?",
      answerTemplate: "Vì quy trình quản lý nội bộ là các quy định vận hành hành chính, kỹ thuật nội bộ của doanh nghiệp, không liên quan đến việc thỏa mãn cảm xúc hay giao tiếp với khách hàng mục tiêu."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "true_false", "multiple_choice"],
      difficultyDistribution: { easy: 70, medium: 20, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh bị nhầm lẫn trong câu hỏi trắc nghiệm phủ định (không quyết định điều gì) và chọn sai chiến lược marketing thay vì quy trình nội bộ.",
      followUpQuestion: "Nếu khách hàng của bạn là người nóng tính, điều đó có làm thay đổi cách kế toán của công ty bạn ghi chép sổ sách kế toán nội bộ không?",
      miniLesson: "Tính cách quyết định thông điệp quảng cáo, hình tượng sản phẩm và chiến lược marketing của công ty, nhưng KHÔNG can thiệp vào quy trình quản lý nội bộ của công ty.",
      relatedConceptToReview: "CB_C3_N1"
    }
  },
  {
    id: "CB_C3_N2",
    chapter: 3,
    topic: "CB_T3.2",
    concept: "Lối sống (Lifestyle)",
    definition: "Là cách thức sống của một cá nhân được thể hiện qua các hoạt động (Activities), mối quan tâm (Interests) và quan điểm (Opinions) - Mô hình AIO.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 4",
    confidence: 5,
    type: "Rule",
    details: "Khác với tính cách mang tính nội tại bền vững sâu sắc, lối sống có tính chất động nhiều hơn và có thể thay đổi theo thời gian.",
    marketingApplication: "Phân khúc thị trường theo phong cách sống (ví dụ: lối sống xanh, lối sống tối giản, lối sống thích xê dịch).",
    commonMistakes: "Đồng nhất lối sống với tính cách hoặc cho rằng lối sống là bất biến suốt đời.",
    
    teaching: {
      learningObjective: "Định nghĩa lối sống thông qua mô hình AIO và phân biệt rõ sự khác biệt về độ linh hoạt giữa lối sống và tính cách.",
      misconception: "Nghĩ rằng lối sống của một người từ lúc sinh ra đến lúc chết đi là hoàn toàn cố định và không bao giờ chịu tác động bởi ngoại cảnh.",
      teachingHint: "Hỏi sinh viên: Lối sống của bạn trước khi dịch Covid và sau dịch Covid có thay đổi không? (Gợi ý: Có, chuyển sang tập thể dục tại nhà, ăn uống lành mạnh hơn). Điều này chứng minh lối sống có thể thay đổi.",
      memoryHook: "Lối sống = AIO (Hoạt động - Quan tâm - Quan điểm) + Có thể thay đổi",
      realWorldExample: "Một người có lối sống hướng ngoại, thích du lịch trải nghiệm (Activities), quan tâm đến bảo vệ môi trường (Interests) và ủng hộ hôn nhân đồng giới (Opinions).",
      marketingExample: "IKEA thiết kế đồ nội thất thông minh nhắm thẳng vào lối sống tối giản của cư dân đô thị sống trong các căn hộ diện tích nhỏ.",
      counterExample: "Việc một người có chỉ số IQ cao hay thấp là thuộc tính trí tuệ nội tại bền vững, không phải là lối sống."
    },
    dependencies: {
      requires: [],
      requiredBy: [],
      relatedConcepts: ["CB_C3_N1"],
      oppositeConcepts: [],
      confusedWith: ["Tính cách"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 8,
      estimatedRetentionDifficulty: "easy",
      firstReviewDays: 2,
      secondReviewDays: 7,
      thirdReviewDays: 30
    },
    explanation: {
      simpleExplanation: "Lối sống là cách một người dành thời gian và tiền bạc cho các hoạt động, sở thích và quan điểm sống hàng ngày của họ, và lối sống có thể thay đổi theo thời gian.",
      mediumExplanation: "Lối sống phản ánh cách thức tương tác của một người với thế giới xung quanh qua mô hình AIO. Khác với tính cách sâu kín bên trong, lối sống dễ quan sát hơn và có tính chất biến động khi môi trường sống thay đổi.",
      expertExplanation: "Lối sống (Lifestyle) là biểu hiện hành vi bên ngoài của bản sắc cá nhân và định hướng giá trị. Khảo sát lối sống qua hệ thống VALS hoặc mô hình AIO cho phép marketer xây dựng chiến dịch truyền thông cộng hưởng sâu sắc với hệ giá trị của người tiêu dùng.",
      analogy: "Nếu tính cách là phần cứng của máy tính thì lối sống giống như các phần mềm ứng dụng được cài đặt: bạn có thể cài thêm ứng dụng mới hoặc xóa ứng dụng cũ đi khi nhu cầu sống thay đổi.",
      commonStudentQuestion: "Lối sống có thay đổi theo thời gian không?",
      answerTemplate: "Chắc chắn có. Lối sống của con người liên tục biến đổi dưới tác động của tuổi tác, thu nhập, sự nghiệp và các biến cố xã hội."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "true_false", "multiple_choice"],
      difficultyDistribution: { easy: 80, medium: 20, hard: 0, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh cho rằng lối sống là bất biến như tính cách nên chọn đáp án SAI cho câu hỏi đúng sai về lối sống.",
      followUpQuestion: "Khi bạn đi làm và có thu nhập cao hơn thời sinh viên, thói quen ăn uống và giải trí của bạn có thay đổi không?",
      miniLesson: "Lối sống là cách thức sống bên ngoài và CÓ THỂ thay đổi theo thời gian. Đây là một phát biểu hoàn toàn ĐÚNG trong đề thi.",
      relatedConceptToReview: "CB_C3_2"
    }
  },

  // Chương 4
  {
    id: "CB_C4_N1",
    chapter: 4,
    topic: "CB_T4.2",
    concept: "Nhận thức vấn đề & Trạng thái (Problem Recognition)",
    definition: "Là giai đoạn đầu tiên của quy trình quyết định mua hàng, xuất hiện khi người tiêu dùng nhận thức được sự khác biệt giữa trạng thái thực tế và trạng thái lý tưởng vượt quá một ngưỡng nhất định.",
    importance: 5,
    source: "Đề thi mẫu",
    page: "Câu 8, 9, 10",
    confidence: 5,
    type: "Model",
    details: "Trạng thái lý tưởng (Ideal state): mức độ mong muốn cao hơn hiện tại (ví dụ: muốn có một chiếc máy ảnh xuất sắc, muốn mặc đồ hấp dẫn). Trạng thái thực tế (Actual state): tình hình thực tại (ví dụ: quần áo đã cũ). Động cơ hành động tỉ lệ thuận với độ lớn của khoảng cách giữa hai trạng thái này cộng với năng lực (Ability) và cơ hội (Opportunity). Nếu người tiêu dùng KHÔNG nhận thức được vấn đề, động cơ hành động sẽ THẤP chứ không thể CAO.",
    marketingApplication: "Tạo ra các chiến dịch quảng cáo chỉ ra khoảng cách giữa thực tế và lý tưởng để kích hoạt nhu cầu mua sắm.",
    commonMistakes: "Nhầm lẫn tình huống thuộc trạng thái lý tưởng với trạng thái thực tế. Nghĩ rằng động cơ hành động cao khi không nhận thức được vấn đề.",
    
    teaching: {
      learningObjective: "Phân biệt trạng thái thực tế và lý tưởng trong các tình huống thực tiễn, phân tích động cơ hành động dựa trên nhận thức khoảng cách giữa hai trạng thái.",
      misconception: "Nghĩ rằng nhu cầu mua sắm luôn bắt đầu từ việc đồ cũ bị hỏng, phủ nhận trường hợp mua vì ham muốn nâng cấp (trạng thái lý tưởng).",
      teachingHint: "Hướng dẫn sinh viên tự hỏi: Tại sao bạn lại mua điện thoại mới trong khi cái cũ vẫn nghe gọi tốt? (Gợi ý: Vì bạn muốn có camera xịn hơn - Trạng thái lý tưởng vượt lên).",
      memoryHook: "Vấn đề = Lý tưởng - Thực tế > Ngưỡng nhận biết",
      realWorldExample: "Một người cảm thấy lạnh khi mùa đông đến (Trạng thái thực tế) và muốn có một chiếc áo khoác ấm áp (Trạng thái lý tưởng).",
      marketingExample: "Quảng cáo nước xả vải nhấn mạnh việc quần áo giặt xong bị khô cứng (Trạng thái thực tế) để khơi gợi mong muốn có quần áo mềm mại, thơm mát (Trạng thái lý tưởng).",
      counterExample: "Việc một người vô thức bấm vào quảng cáo khi lướt web mà không hề có nhu cầu hay suy nghĩ gì về sản phẩm đó không phải là nhận thức vấn đề có ý thức."
    },
    dependencies: {
      requires: [],
      requiredBy: ["CB_C5_N1"],
      relatedConcepts: ["CB_C4_N2"],
      oppositeConcepts: [],
      confusedWith: ["Trạng thái cân bằng"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 15,
      estimatedRetentionDifficulty: "hard",
      firstReviewDays: 1,
      secondReviewDays: 4,
      thirdReviewDays: 15
    },
    explanation: {
      simpleExplanation: "Nhận thức vấn đề xảy ra khi bạn nhận ra có sự khác biệt giữa những gì bạn 'đang có' (thực tế) và những gì bạn 'muốn có' (lý tưởng). Sự chênh lệch này thúc giục bạn đi mua hàng.",
      mediumExplanation: "Nhận thức vấn đề là điểm khởi đầu của hành trình mua hàng. Có hai trạng thái: trạng thái thực tế (như quần áo cũ) và trạng thái lý tưởng (như muốn trở nên sang trọng hơn). Khoảng cách giữa hai trạng thái càng rộng thì động lực mua hàng càng mạnh mẽ.",
      expertExplanation: "Nhận thức vấn đề (Problem Recognition) được kích hoạt bởi sự mất cân bằng giữa trạng thái thực tại (Actual State) và trạng thái mong đợi (Desired/Ideal State). Doanh nghiệp có thể chủ động kiến tạo nhu cầu bằng cách nâng cao tiêu chuẩn của trạng thái lý tưởng thông qua giáo dục thị trường.",
      analogy: "Nhận thức vấn đề giống như một chiếc cân bập bênh: khi thực tế và lý tưởng thăng bằng thì bạn đứng yên; khi một bên lệch đi quá nhiều, bạn buộc phải bước đi để tìm lại sự thăng bằng.",
      commonStudentQuestion: "Động cơ hành động sẽ thế nào nếu người tiêu dùng không nhận biết được vấn đề?",
      answerTemplate: "Nếu không nhận thức được vấn đề (không thấy có sự chênh lệch), động cơ hành động của họ sẽ cực kỳ THẤP hoặc bằng không. Họ sẽ không có lý do để mua hàng."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "true_false", "application"],
      difficultyDistribution: { easy: 30, medium: 40, hard: 20, veryHard: 10 }
    },
    coaching: {
      likelyReason: "Học sinh nhầm lẫn giữa khao khát (lý tưởng) và hiện trạng (thực tế), hoặc chọn sai phát biểu về mức độ động cơ.",
      followUpQuestion: "Nếu một người thấy điện thoại của mình bị vỡ màn hình, đó là họ đang ở trạng thái thực tế tồi đi hay đang mơ về một trạng thái lý tưởng tuyệt vời?",
      miniLesson: "Quần áo đã cũ, màn hình điện thoại bị vỡ là các trạng thái THỰC TẾ. Muốn có chiếc máy ảnh xuất sắc, muốn mặc đồ lôi cuốn là TRẠNG THÁI LÝ TƯỞNG. Nếu không nhận biết được vấn đề, động cơ hành động của họ sẽ THẤP (phát biểu ngược lại là sai).",
      relatedConceptToReview: "CB_C4_1"
    }
  },
  {
    id: "CB_C4_N2",
    chapter: 4,
    topic: "CB_T4.4",
    concept: "Tìm kiếm thông tin tự thân (Information Search)",
    definition: "Quá trình tìm kiếm các dữ liệu lưu trữ trong trí nhớ ngắn hạn và dài hạn hoặc từ các nguồn bên ngoài để giải quyết vấn đề tiêu dùng.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 6, 22",
    confidence: 5,
    type: "Process",
    details: "Mức độ tự tìm kiếm có thể thay đổi rộng rãi: từ việc chỉ đơn giản nhớ lại một tên thương hiệu quen thuộc (tìm kiếm nội bộ) đến các tìm kiếm chuyên sâu thông qua bộ nhớ dài hạn hoặc nguồn bên ngoài để thu thập thông tin, cảm nhận và trải nghiệm liên quan.",
    marketingApplication: "Tối ưu hóa SEO/SEM và nhận diện thương hiệu để lọt vào bộ nhớ cân nhắc (evoked set) của khách hàng.",
    commonMistakes: "Giới hạn khái niệm tìm kiếm thông tin chỉ ở hành vi tra cứu Google/nguồn ngoài mà bỏ qua quá trình lục tìm thông tin trong trí nhớ (internal search).",
    
    teaching: {
      learningObjective: "Mô tả các mức độ tìm kiếm thông tin và phân biệt rõ ràng giữa tìm kiếm thông tin nội bộ (trí nhớ) và tìm kiếm thông tin bên ngoài.",
      misconception: "Nghĩ rằng bước 'Tìm kiếm thông tin' bắt buộc phải có hoạt động hỏi người khác hoặc tra cứu tài liệu.",
      teachingHint: "Hỏi học sinh: Khi thèm uống nước ngọt, bạn có tra Google không hay chỉ cần nghĩ ngay đến Coca-Cola trong đầu? (Gợi ý: Đó chính là tìm kiếm thông tin trong bộ nhớ - Internal Search).",
      memoryHook: "Tìm kiếm thông tin = Lục trí nhớ (Nội bộ) + Tra bên ngoài (Ngoại vi)",
      realWorldExample: "Khi cần mua một ổ bánh mì ăn sáng, bạn lập tức nhớ lại địa chỉ tiệm bánh mì quen thuộc đầu ngõ (Tìm kiếm nội bộ cực nhanh).",
      marketingExample: "Doanh nghiệp chạy quảng cáo lặp đi lặp lại để khi khách hàng tìm kiếm thông tin trong bộ nhớ (internal search), thương hiệu của họ sẽ hiện lên đầu tiên (Top of Mind).",
      counterExample: "Việc vô tình nhìn thấy một bảng hiệu quảng cáo trên đường đi làm mà không có chủ đích tìm kiếm thì không thuộc quy trình chủ động tìm kiếm thông tin."
    },
    dependencies: {
      requires: ["CB_C4_N1"],
      requiredBy: ["CB_C5_N1"],
      relatedConcepts: [],
      oppositeConcepts: [],
      confusedWith: ["Đánh giá sự lựa chọn"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "easy",
      firstReviewDays: 2,
      secondReviewDays: 8,
      thirdReviewDays: 35
    },
    explanation: {
      simpleExplanation: "Tìm kiếm thông tin là việc bạn tự lục lọi trong đầu xem mình đã biết gì về món đồ đó chưa, hoặc đi hỏi han bạn bè, tra mạng để tìm hiểu kỹ hơn.",
      mediumExplanation: "Tìm kiếm thông tin gồm hai mức độ: Tìm kiếm nội bộ (nhớ lại các thương hiệu cũ từ bộ nhớ) và Tìm kiếm bên ngoài (đi khảo sát, trải nghiệm thực tế). Mức độ tìm kiếm phụ thuộc vào mức độ quan trọng của món đồ.",
      expertExplanation: "Tìm kiếm thông tin (Information Search) là giai đoạn giảm thiểu rủi ro nhận thức (perceived risk) của người tiêu dùng. Tiến trình này trải dài từ tìm kiếm thụ động (heuristics hồi tưởng) đến tìm kiếm tích cực (external information acquisition) tùy thuộc vào mức độ can dự của sản phẩm.",
      analogy: "Tìm kiếm thông tin giống như thám tử phá án: trước hết thám tử phải nhớ lại các hồ sơ cũ trong đầu (nội bộ), nếu chưa đủ thì mới đi thu thập dấu vết ở hiện trường (bên ngoài).",
      commonStudentQuestion: "Mức độ tự tìm kiếm thông tin có thể thay đổi như thế nào?",
      answerTemplate: "Nó thay đổi rất rộng: từ việc chỉ nhớ lại một cái tên thương hiệu đơn giản trong trí nhớ đến các tìm kiếm chuyên sâu thông qua bộ nhớ để tìm thông tin, cảm nhận và trải nghiệm liên quan."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "true_false", "multiple_choice"],
      difficultyDistribution: { easy: 50, medium: 40, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh nghĩ rằng tìm kiếm thông tin bắt buộc phải là hành động đi hỏi hoặc tra cứu thực tế bên ngoài.",
      followUpQuestion: "Khi bạn chỉ đơn giản nhớ lại một thương hiệu quen thuộc trong đầu để quyết định mua, đó có phải là một hành động tìm kiếm thông tin từ bộ nhớ không?",
      miniLesson: "Mức độ tự tìm kiếm có thể thay đổi rất rộng rãi, bao gồm cả việc nhớ lại một thương hiệu đơn giản từ bộ nhớ lẫn việc tìm kiếm chuyên sâu từ bên ngoài.",
      relatedConceptToReview: "CB_C4_N2"
    }
  },

  // Chương 5
  {
    id: "CB_C5_N1",
    chapter: 5,
    topic: "CB_T5.1",
    concept: "Quy trình quyết định mua hàng truyền thống",
    definition: "Là một quy trình tuyến tính gồm 5 giai đoạn chính mà người tiêu dùng cá nhân trải qua để đưa ra quyết định tiêu dùng.",
    importance: 5,
    source: "Giáo trình Lê Phúc Loan & Nguyễn Thị Bích Trâm (2022)",
    page: "Câu 6, 7, 21",
    confidence: 5,
    type: "Process",
    details: "5 giai đoạn gồm: (1) Nhận biết nhu cầu, (2) Tìm kiếm thông tin, (3) Đánh giá các phương án lựa chọn, (4) Quyết định mua hàng, (5) Hành vi sau khi mua (mua lặp lại, tuyên truyền chất lượng...).",
    marketingApplication: "Xây dựng phễu chuyển đổi marketing tương ứng với từng chặng của hành trình ra quyết định.",
    commonMistakes: "Đề thi mẫu chỉ ra câu phát biểu 'Quy trình mua hàng của khách hàng cá nhân có 3 bước' là SAI (thực chất là 5 bước). Ngoài ra, hành vi mua lặp lại và tuyên truyền truyền miệng sau khi mua thuộc bước 'Sau khi mua' (Post-purchase behavior).",
    
    teaching: {
      learningObjective: "Kể tên và sắp xếp đúng thứ tự 5 giai đoạn của quy trình quyết định mua hàng, phân tích đúng hành vi mua lặp lại thuộc giai đoạn sau khi mua.",
      misconception: "Nghĩ rằng quy trình mua hàng kết thúc ngay khi người tiêu dùng thanh toán tiền xong tại quầy thu ngân.",
      teachingHint: "Hỏi sinh viên: Sau khi bạn mua một món đồ ăn không ngon, bạn sẽ làm gì? (Gợi ý: Không bao giờ quay lại và sẽ khuyên bạn bè không mua - Hành vi sau khi mua). Đây là bước cực kỳ quan trọng.",
      memoryHook: "5 Bước mua hàng: Nhu cầu -> Thông tin -> Đánh giá -> Mua -> Sau mua",
      realWorldExample: "Bạn đói bụng (1. Nhận biết nhu cầu); bạn nghĩ xem quanh đây có quán nào và tra cứu GrabFood (2. Tìm kiếm thông tin); bạn so sánh giá và đánh giá sao giữa quán bún và quán phở (3. Đánh giá lựa chọn); bạn bấm đặt mua tô phở (4. Quyết định mua); bạn ăn thấy ngon và để lại đánh giá 5 sao kèm lời khen (5. Sau khi mua).",
      marketingExample: "Doanh nghiệp gửi email chăm sóc khách hàng và tặng voucher cho lần mua kế tiếp để tối ưu hóa giai đoạn 'Sau khi mua'.",
      counterExample: "Sự phân bổ ngân sách sản xuất của nhà máy là hoạt động quản trị chuỗi cung ứng, không nằm trong quy trình quyết định mua của người tiêu dùng."
    },
    dependencies: {
      requires: ["CB_C1_N1"],
      requiredBy: [],
      relatedConcepts: ["CB_C4_N1", "CB_C4_N2"],
      oppositeConcepts: [],
      confusedWith: ["Quy trình bán hàng"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 12,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 1,
      secondReviewDays: 5,
      thirdReviewDays: 18
    },
    explanation: {
      simpleExplanation: "Quy trình mua hàng có 5 bước rõ ràng: cảm thấy thiếu thốn (cần mua), tìm hiểu thông tin, so sánh lựa chọn, tiến hành xuống tiền mua, và đánh giá/sử dụng sau khi mua.",
      mediumExplanation: "Quy trình quyết định mua hàng là tiến trình gồm 5 giai đoạn liên tục. Người tiêu dùng đi qua phễu này để giải quyết một nhu cầu cụ thể. Nhiệm vụ của marketer là loại bỏ rào cản ở từng giai đoạn để dẫn dắt họ đến bước mua hàng và chăm sóc sau khi mua.",
      expertExplanation: "Quy trình quyết định mua hàng (Consumer Decision-Making Process) là mô hình chuẩn hóa mô tả các giai đoạn giải quyết vấn đề của khách hàng cá nhân. Sự thấu hiểu chi tiết hành vi ở từng chặng giúp doanh nghiệp phân bổ ngân sách marketing-mix tối ưu.",
      analogy: "Quy trình mua hàng giống như việc hẹn hò: bắt đầu bằng việc muốn có người yêu (nhận nhu cầu), đi tìm hiểu đối tượng (tìm thông tin), so sánh các vệ tinh xung quanh (đánh giá), quyết định tỏ tình (mua hàng), và chung sống hạnh phúc/chia tay sau đó (sau khi mua).",
      commonStudentQuestion: "Hành động khách hàng đi giới thiệu sản phẩm tốt cho bạn bè thuộc bước nào trong quy trình mua?",
      answerTemplate: "Hành động này thuộc bước 'Hành vi sau khi mua' (Post-purchase behavior). Đây là hành vi mang tính tuyên truyền tích cực, cực kỳ quý giá cho doanh nghiệp."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "true_false", "application"],
      difficultyDistribution: { easy: 50, medium: 40, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh bị đánh lừa bởi các nhận định rút gọn quy trình (như nói quy trình chỉ có 3 bước) hoặc nhầm lẫn bước sau khi mua thuộc bước quyết định mua.",
      followUpQuestion: "Sau khi bạn mua hàng xong, việc bạn quay lại mua lần thứ hai có còn gọi là quy trình ra quyết định lần đầu nữa không, hay nó là kết quả của trải nghiệm sau khi mua?",
      miniLesson: "Quy trình mua hàng cá nhân gồm đúng 5 bước (nhận định nói 3 bước là sai). Việc mua lặp lại và tuyên truyền về chất lượng sau khi sử dụng hoàn toàn thuộc bước 'Sau khi mua'.",
      relatedConceptToReview: "CB_C5_1"
    }
  },

  // Chương 6
  {
    id: "CB_C6_N1",
    chapter: 6,
    topic: "CB_T6.1",
    concept: "Khách hàng tổ chức (Organizational Buyer - B2B)",
    definition: "Các tổ chức mua sắm hàng hóa và dịch vụ để phục vụ cho các nhu cầu hoạt động chung, hoặc để phục vụ cho quá trình sản xuất ra sản phẩm khác, hoặc để bán lại cho người khác kiếm lời.",
    importance: 5,
    source: "Đề thi mẫu",
    page: "Câu 23, 24, 28, 29",
    confidence: 5,
    type: "Definition",
    details: "Bao gồm các doanh nghiệp sản xuất, doanh nghiệp thương mại (bán buôn, bán lẻ), cơ quan nhà nước, tổ chức công cộng, tổ chức phi lợi nhuận và từ thiện. Thị trường tổ chức khác thị trường tiêu dùng ở chỗ: khách hàng có quy mô mua sắm lớn hơn rất nhiều, quan hệ mua bán chặt chẽ hơn, số lượng khách hàng ít hơn và tập trung cao độ về địa lý.",
    marketingApplication: "Phát triển chiến lược bán hàng cá nhân (personal selling) và quản lý tài khoản khách hàng trọng điểm (Key Account Management).",
    commonMistakes: "Nhầm lẫn rằng thị trường tổ chức không bao gồm các tổ chức từ thiện, phi lợi nhuận (đây là phát biểu SAI trong đề thi mẫu!).",
    
    teaching: {
      learningObjective: "Xác định các thành phần cấu thành thị trường tổ chức và so sánh sự khác biệt cơ bản giữa thị trường B2B và B2C về quy mô, số lượng và mối quan hệ.",
      misconception: "Nghĩ rằng khách hàng tổ chức chỉ là các công ty tư nhân sản xuất công nghiệp hướng tới mục tiêu lợi nhuận thuần túy.",
      teachingHint: "Hỏi sinh viên: Một trường đại học công lập hay một quỹ từ thiện xây nhà tình nghĩa có cần mua xi măng, bàn ghế không? Họ có phải là cá nhân mua dùng riêng không? (Gợi ý: Họ là khách hàng tổ chức).",
      memoryHook: "Khách hàng tổ chức = Sản xuất + Bán lại + Vận hành chung (Bao gồm cả Phi lợi nhuận)",
      realWorldExample: "Trường Đại học Mở mua 500 chiếc máy tính để trang bị cho phòng máy thực hành của sinh viên.",
      marketingExample: "Hãng Intel không bán chip trực tiếp cho người tiêu dùng cuối mà bán số lượng lớn cho Asus, Dell để lắp ráp máy tính (Khách hàng tổ chức).",
      counterExample: "Một sinh viên mua một chiếc máy tính xách tay tại cửa hàng FPT Shop để học tập cá nhân là hành vi của khách hàng tiêu dùng cá nhân (B2C)."
    },
    dependencies: {
      requires: [],
      requiredBy: ["CB_C6_N2", "CB_C6_N3"],
      relatedConcepts: ["CB_C1_N1"],
      oppositeConcepts: ["Khách hàng cá nhân (B2C)"],
      confusedWith: ["Khách hàng chính phủ đơn thuần"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 15,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 1,
      secondReviewDays: 6,
      thirdReviewDays: 22
    },
    explanation: {
      simpleExplanation: "Khách hàng tổ chức là các công ty, cơ quan nhà nước, trường học hoặc hội từ thiện mua hàng số lượng lớn để phục vụ sản xuất, bán lại kiếm lời, hoặc để vận hành tổ chức đó.",
      mediumExplanation: "Thị trường khách hàng tổ chức gồm tất cả các đơn vị mua hàng hóa/dịch vụ cho hoạt động sản xuất, thương mại bán lại, hoặc cung cấp dịch vụ công. Quy mô giao dịch của họ cực lớn và họ đòi hỏi sự chuyên nghiệp cao hơn thị trường cá nhân.",
      expertExplanation: "Thị trường khách hàng tổ chức (B2B Market) được đặc trưng bởi quá trình mua sắm mang tính lý trí cao, quy mô đơn hàng lớn, cầu phái sinh và quan hệ đối tác dài hạn. Nó bao gồm khu vực tư nhân sản xuất, thương mại, khu vực công và phi lợi nhuận.",
      analogy: "Khách hàng cá nhân giống như người đi chợ mua một bó rau cho bữa tối; khách hàng tổ chức giống như một nhà hàng mua cả tấn rau sạch mỗi ngày theo hợp đồng cung ứng cả năm.",
      commonStudentQuestion: "Thị trường tổ chức có loại trừ các tổ chức từ thiện, phi lợi nhuận không?",
      answerTemplate: "Tuyệt đối không. Đây là hiểu lầm nghiêm trọng. Các tổ chức phi lợi nhuận và từ thiện vẫn mua sắm lượng lớn văn phòng phẩm, trang thiết bị để hoạt động, nên họ hoàn toàn thuộc thị trường tổ chức."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "comparison", "true_false", "multiple_choice"],
      difficultyDistribution: { easy: 40, medium: 40, hard: 20, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh bị lừa bởi câu hỏi phát biểu không đúng về thị trường tổ chức và đánh dấu phương án loại trừ các tổ chức phi lợi nhuận.",
      followUpQuestion: "Khi Hội Chữ Thập Đỏ mua 10.000 thùng mì tôm để cứu trợ, đó có phải là một giao dịch thương mại mua lẻ cá nhân không?",
      miniLesson: "Thị trường khách hàng tổ chức bao gồm cả các tổ chức từ thiện và phi lợi nhuận. Phát biểu nói 'Không bao gồm các tổ chức từ thiện, phi lợi nhuận' là phát biểu KHÔNG ĐÚNG.",
      relatedConceptToReview: "CB_C6_N1"
    }
  },
  {
    id: "CB_C6_N2",
    chapter: 6,
    topic: "CB_T6.1",
    concept: "Phân loại thị trường khách hàng tổ chức",
    definition: "Hệ thống phân chia khách hàng tổ chức thành các nhóm dựa trên bản chất hoạt động kinh tế và mục tiêu mua sắm.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 24, 30",
    confidence: 5,
    type: "Classification",
    details: "Ba dạng thường gặp: (1) Thị trường tư liệu, sản xuất (Producers), (2) Thị trường người buôn bán trung gian (Resellers), (3) Thị trường các cơ quan nhà nước và tổ chức phi lợi nhuận (Government & Institutions). Khách hàng tổ chức thuộc loại trung gian có mục đích mua sắm khác hẳn cá nhân ở điểm cốt lõi là 'Kiếm lời' (Resell for profit).",
    marketingApplication: "Cung cấp chiết khấu thương mại, chính sách đổi trả linh hoạt và hỗ trợ đồng marketing (co-marketing) cho khách hàng trung gian.",
    commonMistakes: "Đồng nhất mục đích mua sắm của nhà phân phối trung gian với người tiêu dùng cuối cùng (người tiêu dùng mua để thỏa mãn nhu cầu cá nhân/tập thể, còn trung gian mua để kiếm lời).",
    
    teaching: {
      learningObjective: "Phân biệt được ba nhóm khách hàng tổ chức chính và chỉ ra động cơ mua sắm đặc thù của nhóm khách hàng trung gian thương mại.",
      misconception: "Nghĩ rằng siêu thị Big C hay đại lý tạp hóa mua bánh kẹo về là để nhân viên siêu thị ăn dần (tiêu dùng tập thể).",
      teachingHint: "Hãy hỏi sinh viên: Tại sao chủ tiệm tạp hóa lại nhập 100 thùng bia về cửa hàng trước Tết? Động cơ của họ là gì? (Gợi ý: Để bán lại kiếm lời chênh lệch - Resell for profit).",
      memoryHook: "Sản xuất = Chế biến; Trung gian = Kiếm lời; Nhà nước = Phục vụ cộng đồng",
      realWorldExample: "Đại lý phân phối Honda mua xe máy từ nhà máy Honda Việt Nam để phân phối lại cho người dân.",
      marketingExample: "Unilever xây dựng đội ngũ Sales Admin hùng hậu để hỗ trợ các nhà phân phối trung gian tối ưu hóa dòng tiền và gia tăng lợi nhuận bán lại.",
      counterExample: "Sở Giáo dục mua bàn ghế trang bị cho các trường học là thị trường cơ quan nhà nước, không phải nhằm mục tiêu bán lại kiếm lời trực tiếp."
    },
    dependencies: {
      requires: ["CB_C6_N1"],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: [],
      confusedWith: ["Thị trường tiêu dùng"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "easy",
      firstReviewDays: 2,
      secondReviewDays: 7,
      thirdReviewDays: 30
    },
    explanation: {
      simpleExplanation: "Khách hàng tổ chức được chia làm 3 loại chính: nơi mua về để sản xuất đồ khác, nơi mua về để bán lại ăn chênh lệch (kiếm lời), và cơ quan nhà nước mua để dùng chung cho xã hội.",
      mediumExplanation: "Thị trường tổ chức gồm 3 nhóm chính: Nhà sản xuất, Nhà trung gian (bán buôn/bán lẻ), và Cơ quan nhà nước/Tổ chức xã hội. Trong đó, đối tượng trung gian mua sắm không phải để tiêu dùng mà hướng tới mục tiêu duy nhất là 'kiếm lời' thông qua việc bán lại.",
      expertExplanation: "Phân loại khách hàng tổ chức (B2B Segmentation) dựa trên chuỗi giá trị mà họ tham gia. Việc định vị động cơ mua sắm của nhóm Reseller (kiếm lời) đòi hỏi doanh nghiệp phải cung cấp các giải pháp thương mại (trade marketing) thay vì giải pháp tính năng sản phẩm.",
      analogy: "Nhà sản xuất giống như thợ làm bánh; nhà trung gian giống như cửa hàng ký gửi bánh để ăn phần trăm chênh lệch; cơ quan nhà nước giống như quỹ từ thiện mua bánh phát cho trẻ em nghèo.",
      commonStudentQuestion: "Mục đích mua sắm của nhà trung gian (Reseller) khác người tiêu dùng cá nhân thế nào?",
      answerTemplate: "Người tiêu dùng cá nhân mua để thỏa mãn nhu cầu tiêu dùng trực tiếp. Còn nhà trung gian mua sắm để bán lại và mục tiêu cốt lõi là KIẾM LỜI."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "comparison", "multiple_choice"],
      difficultyDistribution: { easy: 50, medium: 40, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh nhầm lẫn mục đích của nhà trung gian sang hướng phục vụ đám đông hoặc tiêu dùng tập thể do quy mô đơn hàng lớn.",
      followUpQuestion: "Khi một siêu thị điện máy nhập 1000 chiếc tivi, mục đích chính của họ là để nhân viên cùng xem tivi cho vui hay là để bán lại ăn chênh lệch?",
      miniLesson: "Đối với khách hàng tổ chức thuộc loại trung gian, mục đích mua sắm cốt lõi giúp họ khác biệt hoàn toàn với người tiêu dùng cá nhân là 'Kiếm lời'.",
      relatedConceptToReview: "CB_C6_N2"
    }
  },
  {
    id: "CB_C6_N3",
    chapter: 6,
    topic: "CB_T6.2",
    concept: "Đặc điểm nhu cầu tổ chức (B2B Demand Characteristics)",
    definition: "Các thuộc tính đặc thù quy định động lực và quy mô của cầu trên thị trường B2B.",
    importance: 5,
    source: "Đề thi mẫu",
    page: "Câu 27",
    confidence: 5,
    type: "Rule",
    details: "Có 3 đặc điểm cốt lõi: (1) Nhu cầu bắt nguồn từ nhu cầu của người tiêu dùng cuối cùng (Derived Demand), (2) Số lượng khách hàng thường ít hơn và tập trung hơn so với người tiêu dùng cá nhân, (3) Khách hàng tổ chức thường mua sắm theo định kỳ thông qua các hợp đồng kinh tế.",
    marketingApplication: "Theo dõi sát sao hành vi và xu hướng tiêu dùng ở thị trường cuối (B2C) để dự báo chính xác cầu ở thị trường B2B.",
    commonMistakes: "Nghĩ rằng nhu cầu B2B là độc lập hoàn toàn và không chịu ảnh hưởng bởi biến động của thị trường tiêu dùng cuối.",
    
    teaching: {
      learningObjective: "Giải thích rõ khái niệm cầu phái sinh (Derived demand) và phân tích ảnh hưởng của biến động thị trường tiêu dùng cuối đối với cầu ở thị trường tổ chức.",
      misconception: "Nghĩ rằng nhu cầu mua sắm linh kiện điện tử của Samsung hoàn toàn không liên quan gì đến việc người dân có thích mua điện thoại thông minh hay không.",
      teachingHint: "Dùng từ 'bắt nguồn'. Vẽ một sơ đồ: Người tiêu dùng mua ít giày da (B2C) -> Nhà máy sản xuất giày mua ít da bò hơn (B2B) -> Trang trại bán ít da thô hơn.",
      memoryHook: "Cầu B2B = Cầu phái sinh (ăn theo B2C) + Khách ít & Lớn + Định kỳ hợp đồng",
      realWorldExample: "Khi thị trường bất động sản đóng băng, người dân không mua nhà mới (B2C), dẫn đến các nhà thầu xây dựng ngừng mua xi măng, sắt thép (B2B).",
      marketingExample: "Hãng sản xuất chip sáp nhập với các nhãn hàng máy tính để thực hiện chiến dịch 'Intel Inside' nhằm kích cầu người tiêu dùng cuối, từ đó tăng doanh số bán chip B2B của mình.",
      counterExample: "Nhu cầu mua muối ăn của các hộ gia đình là cầu trực tiếp, không phụ thuộc vào một quy trình sản xuất thương mại trung gian nào khác."
    },
    dependencies: {
      requires: ["CB_C6_N1"],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: ["Cầu trực tiếp (Direct Demand)"],
      confusedWith: ["Cầu co giãn hoàn toàn"]
    },
    review: {
      reviewPriority: "high",
      estimatedStudyMinutes: 15,
      estimatedRetentionDifficulty: "hard",
      firstReviewDays: 1,
      secondReviewDays: 5,
      thirdReviewDays: 20
    },
    explanation: {
      simpleExplanation: "Nhu cầu mua hàng của doanh nghiệp không tự dưng sinh ra, nó bắt nguồn từ việc người tiêu dùng cuối cùng có chịu mua hàng của họ hay không. Ngoài ra, số lượng người mua B2B rất ít nhưng mua lô cực lớn và ký hợp đồng định kỳ.",
      mediumExplanation: "Nhu cầu trên thị trường tổ chức có tính chất phái sinh (derived). Điều này có nghĩa là cầu về tư liệu sản xuất do cầu về sản phẩm tiêu dùng quyết định. Ngoài ra, thị trường B2B có đặc điểm tập trung cao độ, số lượng người mua ít hơn hẳn nhưng quy mô giao dịch lớn gấp nhiều lần thị trường B2C.",
      expertExplanation: "Đặc điểm nhu cầu B2B (Derived Demand) đòi hỏi một mô hình dự báo thị trường đa tầng. Biến động nhỏ ở thị trường tiêu dùng cuối có thể gây ra hiện tượng Bullwhip Effect (hiệu ứng chiếc roi da) khốc liệt ở thượng nguồn chuỗi cung ứng.",
      analogy: "Nhu cầu tổ chức giống như toa tàu ở phía sau: nó chỉ có thể chuyển động nhanh hay chậm tùy thuộc vào đầu kéo là nhu cầu tiêu dùng cuối cùng ở phía trước.",
      commonStudentQuestion: "Tại sao nói nhu cầu khách hàng tổ chức bắt nguồn từ người tiêu dùng cá nhân?",
      answerTemplate: "Vì nếu người tiêu dùng cá nhân ngừng mua sản phẩm cuối (ví dụ: nước ngọt), các nhà sản xuất sẽ lập tức ngừng đặt hàng nguyên liệu đầu vào (ví dụ: vỏ lon, đường hóa học)."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "scenario", "multiple_choice", "reasoning"],
      difficultyDistribution: { easy: 30, medium: 45, hard: 25, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh chọn thiếu các đặc tính khi đề thi hỏi phát biểu đúng nhất, hoặc không liên kết được cầu phái sinh với người tiêu dùng cuối.",
      followUpQuestion: "Nếu người dân hoàn toàn không đi xe máy nữa, các hãng lốp xe có bán được lốp cho nhà máy lắp ráp xe máy nữa không?",
      miniLesson: "Nhu cầu tổ chức bắt nguồn từ nhu cầu tiêu dùng cuối; số lượng khách hàng tổ chức ít và tập trung hơn; việc mua bán diễn ra định kỳ qua hợp đồng. Tất cả các ý này đều đúng.",
      relatedConceptToReview: "CB_C6_N3"
    }
  },

  // Chương 7
  {
    id: "CB_C7_N1",
    chapter: 7,
    topic: "CB_T7.1",
    concept: "Hành vi mua sắm tư liệu sản xuất",
    definition: "Quá trình và các điều kiện ràng buộc khi doanh nghiệp tiến hành mua sắm máy móc thiết bị, nguyên vật liệu phục vụ sản xuất.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 25",
    confidence: 5,
    type: "Rule",
    details: "Đặc điểm nổi bật của hoạt động này là: Việc mua sắm có kế hoạch, chính sách mua được định ra trước và tỷ lệ các hợp đồng mua sắm dài hạn ngày càng gia tăng nhằm đảm bảo tính ổn định của nguồn cung.",
    marketingApplication: "Đề xuất các giải pháp cung ứng trọn gói dài hạn (SLA) và tích hợp hệ thống đặt hàng tự động (EDI/ERP) cho đối tác sản xuất.",
    commonMistakes: "Cho rằng việc mua sắm tư liệu sản xuất mang tính phân tán, ngẫu hứng hoặc không định sẵn chính sách mua từ trước.",
    
    teaching: {
      learningObjective: "Liệt kê các thuộc tính đặc thù của quy trình mua sắm tư liệu sản xuất và giải thích tầm quan trọng của hợp đồng mua sắm dài hạn.",
      misconception: "Nghĩ rằng nhân viên thu mua của nhà máy có thể tự ý ra chợ mua bất kỳ máy móc nào họ thích giống như đi mua quần áo cá nhân.",
      teachingHint: "Nhấn mạnh các từ khóa: 'Kế hoạch', 'Định trước', 'Hợp đồng dài hạn'. Thảo luận về việc nếu nguồn cung cấp thép cho nhà máy ô tô bị gián đoạn 1 ngày thì hậu quả sẽ thế nào.",
      memoryHook: "Mua tư liệu = Có kế hoạch + Định trước + Ký dài hạn",
      realWorldExample: "Nhà máy sữa Vinamilk ký hợp đồng bao tiêu sản phẩm dài hạn 5 năm với các trang trại nuôi bò sữa địa phương để đảm bảo nguồn cung ổn định.",
      marketingExample: "Doanh nghiệp cung cấp linh kiện thiết lập chính sách cam kết chất lượng dài hạn và tích hợp hệ thống cảnh báo tồn kho tự động với đối tác.",
      counterExample: "Việc giám đốc công ty đột xuất chi tiền mua một giỏ hoa chúc mừng đối tác là hành động mua sắm hành chính phát sinh, không phản ánh quy trình mua tư liệu sản xuất chuẩn hóa."
    },
    dependencies: {
      requires: ["CB_C6_N1"],
      requiredBy: [],
      relatedConcepts: ["CB_C6_N3"],
      oppositeConcepts: [],
      confusedWith: ["Mua sắm tiêu dùng ngẫu hứng"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 3,
      secondReviewDays: 10,
      thirdReviewDays: 45
    },
    explanation: {
      simpleExplanation: "Khi công ty mua máy móc, nguyên liệu để sản xuất, họ phải lên kế hoạch cực kỳ kỹ lưỡng từ trước, có quy định rõ ràng và xu hướng ký các hợp đồng mua bán dài hạn để tránh bị đứt gãy nguồn cung.",
      mediumExplanation: "Mua sắm tư liệu sản xuất đòi hỏi tính kỷ luật và sự an toàn cao. Doanh nghiệp thiết lập chính sách mua định sẵn, xây dựng tiêu chuẩn kỹ thuật nghiêm ngặt và gia tăng tỷ lệ hợp đồng dài hạn nhằm duy trì dây chuyền sản xuất liên tục.",
      expertExplanation: "Tiến trình mua sắm tư liệu sản xuất (Industrial Procurement) được quản lý chặt chẽ bởi các chỉ số KPI hiệu suất và quản trị rủi ro nguồn cung. Sự gia tăng các hợp đồng dài hạn thể hiện nỗ lực giảm thiểu chi phí giao dịch và đảm bảo chuỗi cung ứng vững chắc.",
      analogy: "Mua sắm tư liệu sản xuất giống như việc chuẩn bị lương thực cho một chuyến thám hiểm Bắc Cực kéo dài 1 năm: mọi thứ phải được tính toán chính xác, kiểm duyệt nghiêm ngặt và đặt hàng dài hạn, không có chỗ cho việc 'thiếu thì chạy ra chợ mua'.",
      commonStudentQuestion: "Tại sao tỷ lệ các hợp đồng mua dài hạn lại ngày càng gia tăng ở thị trường B2B?",
      answerTemplate: "Để đảm bảo tính ổn định tối đa của nguồn cung, giảm thiểu rủi ro biến động giá cả trên thị trường và xây dựng mối quan hệ hợp tác chiến lược tin cậy giữa hai doanh nghiệp."
    },
    questionGen: {
      possibleQuestionTypes: ["definition", "true_false", "multiple_choice", "application"],
      difficultyDistribution: { easy: 40, medium: 40, hard: 20, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh bị bẫy bởi phương án mô tả việc mua sắm tư liệu sản xuất mang tính phân tán hoặc không định trước chính sách.",
      followUpQuestion: "Nếu một hãng sản xuất ô tô mua linh kiện theo kiểu thích thì mua ngẫu hứng, dây chuyền sản xuất của họ có thể vận hành ổn định không?",
      miniLesson: "Đặc điểm của tổ chức mua sắm tư liệu sản xuất là: chính sách mua được định trước, có kế hoạch rõ ràng và tỷ lệ hợp đồng mua dài hạn gia tăng. Chọn đáp án này mới chính xác.",
      relatedConceptToReview: "CB_C7_N1"
    }
  },
  {
    id: "CB_C7_N2",
    chapter: 7,
    topic: "CB_T7.2",
    concept: "Yếu tố ảnh hưởng hành vi mua tổ chức (B2B Influences)",
    definition: "Hệ thống các lực lượng tác động lên quyết định mua sắm của một tổ chức, phân chia thành môi trường vĩ mô và vi mô.",
    importance: 4,
    source: "Đề thi mẫu",
    page: "Câu 26",
    confidence: 5,
    type: "Classification",
    details: "Các yếu tố môi trường bao gồm: Các chương trình marketing của nhà cung cấp, yếu tố văn hóa, xã hội và mức độ cạnh tranh trên thị trường. Các yếu tố nội bộ như hệ thống vận hành nhà máy, quy trình sản xuất thuộc nhóm yếu tố thuộc về tổ chức (Organizational factors) chứ không phải yếu tố môi trường bên ngoài.",
    marketingApplication: "Phân tích môi trường cạnh tranh để định vị lợi thế giao hàng nhanh hoặc chính sách bảo hành dài hạn vượt trội.",
    commonMistakes: "Xếp các yếu tố vận hành nội bộ (như hệ thống vận hành nhà máy) vào nhóm yếu tố môi trường bên ngoài ảnh hưởng đến hành vi mua.",
    
    teaching: {
      learningObjective: "Phân biệt rõ yếu tố tác động thuộc về môi trường (bên ngoài) và yếu tố thuộc về tổ chức (nội bộ) đối với quyết định mua sắm B2B.",
      misconception: "Coi mọi thứ liên quan đến hoạt động của công ty khách hàng (bao gồm cả kỹ thuật máy móc của họ) đều là yếu tố môi trường bên ngoài.",
      teachingHint: "Vẽ hai vòng tròn đồng tâm. Vòng tròn ngoài là môi trường vĩ mô/vi mô (luật pháp, đối thủ, văn hóa, marketing của bên ngoài). Vòng tròn trong là nội bộ doanh nghiệp (sơ đồ tổ chức, hệ thống vận hành nhà máy).",
      memoryHook: "Môi trường = Bên ngoài; Tổ chức/Vận hành = Bên trong",
      realWorldExample: "Sự suy thoái kinh tế toàn cầu khiến doanh nghiệp thắt chặt ngân sách mua sắm phần mềm ERP (Yếu tố môi trường kinh tế).",
      marketingExample: "Một nhà cung cấp thiết bị y tế phân tích cấu trúc mua sắm nội bộ của bệnh viện để biết trưởng khoa hay giám đốc mới là người quyết định cuối cùng.",
      counterExample: "Sự thay đổi về công suất vận hành của máy móc trong xưởng sản xuất là yếu tố vận hành tổ chức nội bộ, không phải là lực lượng thuộc môi trường bên ngoài."
    },
    dependencies: {
      requires: ["CB_C6_N1"],
      requiredBy: [],
      relatedConcepts: [],
      oppositeConcepts: [],
      confusedWith: ["Hệ thống vận hành nhà máy"]
    },
    review: {
      reviewPriority: "medium",
      estimatedStudyMinutes: 10,
      estimatedRetentionDifficulty: "medium",
      firstReviewDays: 3,
      secondReviewDays: 10,
      thirdReviewDays: 45
    },
    explanation: {
      simpleExplanation: "Yếu tố môi trường là những thứ bên ngoài công ty ảnh hưởng đến việc mua sắm như đối thủ cạnh tranh, văn hóa xã hội và các chương trình tiếp thị. Còn máy móc hay cách vận hành trong nhà máy là yếu tố nội bộ của họ.",
      mediumExplanation: "Quyết định mua của tổ chức chịu ảnh hưởng của hai nhóm tác nhân lớn. Yếu tố môi trường gồm các biến số vĩ mô (văn hóa, kinh tế) và vi mô (đối thủ, nhà tiếp thị). Yếu tố nội bộ tổ chức bao gồm mục tiêu, chính sách, cơ cấu quyền lực và hệ thống vận hành kỹ thuật.",
      expertExplanation: "Mô hình phân tích hành vi mua tổ chức (Webster and Wind model) phân tách các biến số tác động thành: Môi trường (Environmental), Tổ chức (Organizational), Nhóm (Interpersonal), và Cá nhân (Individual). Nhầm lẫn giữa biến số môi trường và biến số tổ chức dẫn đến việc đánh giá sai lệch trọng số quyết định.",
      analogy: "Yếu tố môi trường giống như thời tiết bão bùng ngoài khơi bắt bạn phải thả neo (bên ngoài); yếu tố tổ chức giống như động cơ tàu bị hỏng bắt bạn phải dừng lại sửa (bên trong).",
      commonStudentQuestion: "Hệ thống vận hành nhà máy có phải là yếu tố môi trường ảnh hưởng hành vi mua tổ chức?",
      answerTemplate: "Không. Hệ thống vận hành nhà máy, quy trình kỹ thuật, năng lực sản xuất nội bộ là các yếu tố thuộc về bản thân TỔ CHỨC đó, không phải là yếu tố môi trường bên ngoài."
    },
    questionGen: {
      possibleQuestionTypes: ["comparison", "true_false", "multiple_choice"],
      difficultyDistribution: { easy: 40, medium: 50, hard: 10, veryHard: 0 }
    },
    coaching: {
      likelyReason: "Học sinh lầm tưởng hệ thống vận hành nhà máy là một tác nhân bên ngoài tác động khách quan do tính chất vật lý của nhà xưởng.",
      followUpQuestion: "Nếu nhà xưởng đó thuộc quyền sở hữu và quản lý hoàn toàn của doanh nghiệp mua hàng, nó là yếu tố nội bộ hay yếu tố môi trường bên ngoài của chính doanh nghiệp đó?",
      miniLesson: "Các chương trình marketing, văn hóa, xã hội, sự cạnh tranh là yếu tố môi trường. Hệ thống vận hành nhà máy là yếu tố thuộc về tổ chức nội bộ. Đề thi hỏi mô tả SAI thì chọn 'Hệ thống vận hành nhà máy' là đáp án đúng.",
      relatedConceptToReview: "CB_C7_N2"
    }
  }
];

export const cbConceptMap: ConceptLink[] = [
  {
    sourceId: "CB_C1_N1",
    targetId: "CB_C5_N1",
    relationship: "chi phối",
    description: "Định nghĩa tổng quát hành vi khách hàng bao hàm toàn bộ tiến trình của quy trình quyết định mua hàng 5 bước."
  },
  {
    sourceId: "CB_C5_N1",
    targetId: "CB_C4_N1",
    relationship: "khởi đầu bằng",
    description: "Giai đoạn 1 của quy trình quyết định mua hàng cá nhân chính là Nhận biết vấn đề (khoảng cách thực tế và lý tưởng)."
  },
  {
    sourceId: "CB_C4_N1",
    targetId: "CB_C4_N2",
    relationship: "kích hoạt",
    description: "Khi nhận biết vấn đề vượt ngưỡng, người tiêu dùng sẽ được kích hoạt để tiến hành tìm kiếm thông tin tự thân hoặc tìm kiếm bên ngoài."
  },
  {
    sourceId: "CB_C2_N1",
    targetId: "CB_C1_N2",
    relationship: "ứng dụng vào",
    description: "Sự thấu hiểu các nhánh văn hóa (như tôn giáo) giúp thiết kế sản phẩm phù hợp (như đạt chứng nhận HALAL)."
  },
  {
    sourceId: "CB_C3_N1",
    targetId: "CB_C1_N2",
    relationship: "quy định",
    description: "Tính cách bền vững của khách hàng quy định trực tiếp thông điệp quảng cáo và hình tượng thương hiệu trong chiến lược marketing hỗn hợp."
  },
  {
    sourceId: "CB_C6_N1",
    targetId: "CB_C6_N3",
    relationship: "quy định thuộc tính",
    description: "Bản chất khách hàng tổ chức quy định thuộc tính nhu cầu của họ là cầu phái sinh (derived demand), phụ thuộc trực tiếp vào cầu tiêu dùng cuối."
  },
  {
    sourceId: "CB_C6_N2",
    targetId: "CB_C6_N1",
    relationship: "là phân loại của",
    description: "Thị trường người buôn bán trung gian là một phân đoạn cốt lõi của thị trường khách hàng tổ chức, có hành vi mua nhằm mục tiêu bán lại kiếm lời."
  }
];

export const cbExamPatterns: ExamPattern[] = [
  {
    topic: "Đặc điểm khách hàng tổ chức (B2B)",
    frequency: "High",
    bloomLevel: "Understand",
    questionType: "Multiple Choice",
    trapDescription: "Bẫy học sinh bằng cách phát biểu rằng thị trường tổ chức không bao gồm các tổ chức phi lợi nhuận/từ thiện, hoặc bẫy về quy mô khách hàng (cho rằng số lượng người mua B2B đông hơn B2C)."
  },
  {
    topic: "Trạng thái Nhận thức vấn đề (Thực tế vs Lý tưởng)",
    frequency: "High",
    bloomLevel: "Apply",
    questionType: "Scenario",
    trapDescription: "Đưa ra tình huống thực tế (ví dụ: quần áo đã cũ) và lý tưởng (muốn mặc đồ hấp dẫn) rồi yêu cầu xác định trạng thái. Bẫy bằng phát biểu động cơ hành động sẽ cao kể cả khi không nhận biết được vấn đề."
  },
  {
    topic: "Nhánh văn hóa & Tôn giáo",
    frequency: "Medium",
    bloomLevel: "Remember",
    questionType: "Multiple Choice",
    trapDescription: "Hỏi về chứng nhận HALAL phục vụ nhánh văn hóa nào. Bẫy bằng các phương án gây nhiễu nhân khẩu học như dân tộc, chủng tộc, quốc gia."
  },
  {
    topic: "Quyền lực xã hội (Social Power)",
    frequency: "Medium",
    bloomLevel: "Apply",
    questionType: "Multiple Choice",
    trapDescription: "Đưa ra hành vi ngưỡng mộ và sao chép để hỏi về Quyền lực tham chiếu, hoặc hành vi dựa trên tri thức thông tin để hỏi về Quyền lực chuyên gia."
  },
  {
    topic: "Tính cách và Lối sống",
    frequency: "Medium",
    bloomLevel: "Understand",
    questionType: "True/False",
    trapDescription: "Hỏi về tính bền vững. Lối sống có thể thay đổi theo thời gian nhưng tính cách mang tính bền vững cao hơn. Bẫy bằng việc tuyên bố tính cách quyết định quy trình quản lý nội bộ doanh nghiệp."
  },
  {
    topic: "Quy trình mua hàng cá nhân và tổ chức",
    frequency: "High",
    bloomLevel: "Remember",
    questionType: "Multiple Choice",
    trapDescription: "Hỏi số bước trong quy trình mua hàng cá nhân (5 bước). Bẫy bằng cách đưa ra các con số nhiễu như 3 bước, 4 bước."
  }
];

export const cbDistractors: DistractorItem[] = [
  {
    conceptId: "CB_C2_N1",
    correctAnswer: "năng động và phát triển",
    distractor: "bền vững và không thay đổi",
    reason: "Sinh viên thường nhầm lẫn văn hóa/nhánh văn hóa là di sản cố định, không đổi qua thời gian, trong khi thực tế chúng liên tục biến chuyển."
  },
  {
    conceptId: "CB_C4_N1",
    correctAnswer: "Trạng thái lý tưởng (Ideal State)",
    distractor: "Trạng thái thực tế (Actual State)",
    reason: "Sinh viên nhầm lẫn giữa khao khát nâng cao trải nghiệm (muốn có máy ảnh xuất sắc) với việc giải quyết sự thiếu hụt thực tế (quần áo đã cũ/hỏng)."
  },
  {
    conceptId: "CB_C2_N3",
    correctAnswer: "Quy mô, tình trạng hôn nhân, tuổi thành viên",
    distractor: "Thu nhập gia đình",
    reason: "Thu nhập ảnh hưởng mạnh mẽ tới khả năng chi tiêu nên sinh viên mặc định nghĩ nó là biến số tạo lập trực tiếp của mô hình Vòng đời gia đình."
  },
  {
    conceptId: "CB_C6_N2",
    correctAnswer: "Mục đích kiếm lời",
    distractor: "Mục đích tiêu dùng tập thể",
    reason: "Nhà trung gian mua sắm với số lượng lớn nên dễ bị nhầm là mua để tiêu dùng chung cho tổ chức thay vì mua để bán lại kiếm chênh lệch."
  },
  {
    conceptId: "CB_C7_N2",
    correctAnswer: "Hệ thống vận hành nhà máy là yếu tố nội bộ tổ chức",
    distractor: "Hệ thống vận hành nhà máy là yếu tố môi trường",
    reason: "Vì nhà máy nằm ngoài văn phòng mua sắm nên người học dễ lầm tưởng nó là một tác nhân môi trường tác động khách quan."
  }
];

export const cbBlueprints: BlueprintItem[] = [
  {
    id: "BP_CB_1",
    concept: "Nhận thức vấn đề (Problem Recognition)",
    testedAngles: [
      {
        angle: "Định nghĩa lý thuyết khoảng cách trạng thái",
        difficulty: "Easy",
        examplePrompt: "Nhận thức vấn đề phát sinh từ sự khác biệt giữa hai trạng thái nào?"
      },
      {
        angle: "Phân biệt tình huống thực tế vs lý tưởng",
        difficulty: "Medium",
        examplePrompt: "Hành động mua sắm điện thoại mới khi chiếc cũ bị hỏng hoàn toàn thuộc trạng thái nào?"
      },
      {
        angle: "Phân tích mối quan hệ giữa nhận thức và động cơ",
        difficulty: "Hard",
        examplePrompt: "Nếu người tiêu dùng không nhận biết được khoảng cách trạng thái, động cơ hành động của họ sẽ như thế nào?"
      }
    ]
  },
  {
    id: "BP_CB_2",
    concept: "Đặc điểm khách hàng tổ chức B2B",
    testedAngles: [
      {
        angle: "Thành phần cấu thành thị trường",
        difficulty: "Easy",
        examplePrompt: "Thị trường khách hàng tổ chức có bao gồm các tổ chức phi lợi nhuận và từ thiện không?"
      },
      {
        angle: "Mục đích của khách hàng trung gian",
        difficulty: "Medium",
        examplePrompt: "Điểm khác biệt cốt lõi trong mục đích mua sắm của nhà bán buôn so với người tiêu dùng cá nhân là gì?"
      },
      {
        angle: "Bản chất của cầu phái sinh (Derived Demand)",
        difficulty: "Hard",
        examplePrompt: "Giải thích mối quan hệ khi cầu về thép xây dựng sụt giảm mạnh do thị trường bất động sản đóng băng."
      }
    ]
  }
];

export const cbAdaptiveMetadata: AdaptiveMetadata[] = [
  {
    conceptId: "CB_C1_N1",
    prerequisites: [],
    dependencies: ["CB_C5_N1"],
    recommendedReviewIntervalDays: 7
  },
  {
    conceptId: "CB_C5_N1",
    prerequisites: ["CB_C1_N1"],
    dependencies: ["CB_C4_N1", "CB_C4_N2"],
    recommendedReviewIntervalDays: 5
  },
  {
    conceptId: "CB_C4_N1",
    prerequisites: ["CB_C5_N1"],
    dependencies: [],
    recommendedReviewIntervalDays: 3
  },
  {
    conceptId: "CB_C6_N1",
    prerequisites: [],
    dependencies: ["CB_C6_N2", "CB_C6_N3"],
    recommendedReviewIntervalDays: 10
  }
];
