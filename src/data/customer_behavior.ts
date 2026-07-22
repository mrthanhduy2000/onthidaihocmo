import { Chapter, Topic, Question } from "../types";

export const cbChapters: Chapter[] = [
  {
    id: 1,
    code: "CH1",
    title: "Chương 1: Khái quát về hành vi khách hàng",
    description: "Nghiên cứu khái niệm hành vi khách hàng, các trường phái lý thuyết và vai trò của hành vi tiêu dùng trong việc xây dựng và thực thi các chiến lược marketing hỗn hợp (4Ps)."
  },
  {
    id: 2,
    code: "CH2",
    title: "Chương 2: Yếu tố môi trường ảnh hưởng đến hành vi khách hàng",
    description: "Phân tích tác động của các yếu tố môi trường vĩ mô và vi mô, đặc biệt tập trung vào văn hóa, tiểu văn hóa (nhánh văn hóa), tôn giáo, tầng lớp xã hội, tình huống và pháp luật bảo vệ quyền lợi người tiêu dùng."
  },
  {
    id: 3,
    code: "CH3",
    title: "Chương 3: Yếu tố cá nhân ảnh hưởng đến hành vi khách hàng cá nhân",
    description: "Tìm hiểu các yếu tố cá nhân đặc thù như độ tuổi, giới tính, nghề nghiệp, hoàn cảnh kinh tế, lối sống, nhân cách và đặc biệt là hệ thống quan niệm bản thân (Real Self, Ideal Self, Looking-glass Self)."
  },
  {
    id: 4,
    code: "CH4",
    title: "Chương 4: Yếu tố tâm lý và hành vi khách hàng",
    description: "Nghiên cứu các yếu tố tâm lý cốt lõi: động cơ học tập (tháp Maslow), nhận thức và hệ thống giác quan (ngưỡng tuyệt đối/khác biệt), thái độ (mô hình 3 thành phần) và sự hiểu biết/ghi nhớ của khách hàng."
  },
  {
    id: 5,
    code: "CH5",
    title: "Chương 5: Quá trình mua hàng của khách hàng cá nhân",
    description: "Khám phá quy trình quyết định mua hàng 5 giai đoạn của cá nhân và hành trình trải nghiệm đa kênh thời đại kết nối kỹ thuật số theo mô hình 5A của Philip Kotler."
  },
  {
    id: 6,
    code: "Chương 6",
    title: "Chương 6: Hành vi khách hàng tổ chức và các yếu tố ảnh hưởng",
    description: "Phân biệt hành vi B2B với B2C. Nghiên cứu đặc điểm nhu cầu phái sinh, không co giãn, biến động mạnh và các mong đợi kỹ thuật chủ chốt của thị trường tổ chức."
  },
  {
    id: 7,
    code: "Chương 7",
    title: "Chương 7: Quá trình mua của khách hàng tổ chức",
    description: "Nghiên cứu quy trình mua hàng B2B 7 giai đoạn, các tình huống mua (lặp lại không đổi, có thay đổi, mua mới) và cấu trúc vai trò của các thành viên trong Trung tâm mua hàng (Decision Making Unit)."
  }
];

export const cbTopics: Topic[] = [
  // Chapter 1
  {
    id: "CB_T1.1",
    chapterId: 1,
    title: "Khái niệm và bản chất hành vi khách hàng",
    description: "Tìm hiểu định nghĩa hành vi khách hàng là quá trình cá nhân hoặc nhóm lựa chọn, mua, sử dụng và loại bỏ sản phẩm để thỏa mãn nhu cầu."
  },
  {
    id: "CB_T1.2",
    chapterId: 1,
    title: "Hành vi khách hàng và chiến lược marketing hỗn hợp",
    description: "Ứng dụng nghiên cứu hành vi khách hàng vào thiết kế sản phẩm, định giá tâm lý, tối ưu hóa điểm bán phân phối và lập kế hoạch truyền thông/chiêu thị."
  },
  
  // Chapter 2
  {
    id: "CB_T2.1",
    chapterId: 2,
    title: "Văn hóa và nhánh văn hóa (Tiểu văn hóa)",
    description: "Phân tích vai trò của văn hóa, các nhánh văn hóa theo vùng miền, dân tộc và đặc biệt là tôn giáo (đồ thời trang Hồi giáo, tiêu chuẩn Halal) tác động đến hành vi tiêu dùng."
  },
  {
    id: "CB_T2.2",
    chapterId: 2,
    title: "Tầng lớp xã hội",
    description: "Đo lường tầng lớp xã hội qua nghề nghiệp, thu nhập, giáo dục, tài sản. Nhận thức sự dịch chuyển nhu cầu khi thu nhập không còn là yếu tố quyết định duy nhất."
  },
  {
    id: "CB_T2.3",
    chapterId: 2,
    title: "Tình huống và bối cảnh mua sắm",
    description: "Ảnh hưởng của bối cảnh thời gian, môi trường vật chất xung quanh (mùi vị, âm nhạc, bày trí), bối cảnh xã hội và trạng thái trước khi mua sắm."
  },
  {
    id: "CB_T2.4",
    chapterId: 2,
    title: "Pháp luật bảo vệ quyền lợi người tiêu dùng",
    description: "Tìm hiểu quyền lợi của người tiêu dùng (được an toàn, được thông tin chính xác, được lựa chọn, được bồi thường) và nghĩa vụ kiểm tra, bảo vệ môi trường theo Luật năm 2010."
  },

  // Chapter 3
  {
    id: "CB_T3.1",
    chapterId: 3,
    title: "Độ tuổi, giới tính và nghề nghiệp",
    description: "Nghiên cứu sự khác biệt trong hành vi mua sắm của nam giới (xử lý chọn lọc, chức năng) và nữ giới (xử lý chi tiết, xã hội/quan hệ). Đặc điểm các nhóm tuổi và trang phục theo nghề nghiệp."
  },
  {
    id: "CB_T3.2",
    chapterId: 3,
    title: "Hoàn cảnh kinh tế, lối sống và cá tính",
    description: "Lối sống thể hiện qua hành động, mối quan tâm và quan điểm (AIO). Nhân cách ảnh hưởng ổn định đến sự tự tin, tính độc lập và lòng tôn trọng."
  },
  {
    id: "CB_T3.3",
    chapterId: 3,
    title: "Quan niệm bản thân (Self-Concept)",
    description: "Bản ngã thực tế (Real Self), Bản ngã lý tưởng (Ideal Self), Bản ngã trong mắt người khác (Looking-glass Self) và cách các thương hiệu như Dove, Nike, Apple ứng dụng."
  },

  // Chapter 4
  {
    id: "CB_T4.1",
    chapterId: 4,
    title: "Động cơ và Tháp nhu cầu Maslow",
    description: "Quy trình động cơ từ trạng thái mất cân bằng. Động cơ lý trí, cảm xúc, tiềm ẩn và rõ ràng. Phân khúc khách hàng theo 5 bậc nhu cầu của Abraham Maslow."
  },
  {
    id: "CB_T4.2",
    chapterId: 4,
    title: "Nhận thức và hệ thống giác quan",
    description: "Hành trình tiếp nhận, chú ý và diễn giải kích thích. Ngưỡng tuyệt đối và ngưỡng khác biệt trong điều chỉnh giá cả, thay đổi bao bì và logo thương hiệu."
  },
  {
    id: "CB_T4.3",
    chapterId: 4,
    title: "Thái độ và mô hình thay đổi hành vi",
    description: "Cấu trúc thái độ gồm 3 thành phần: Nhận thức, Cảm xúc và Hành vi. Cách thức thay đổi thái độ người tiêu dùng đối với nhãn hiệu cạnh tranh."
  },
  {
    id: "CB_T4.4",
    chapterId: 4,
    title: "Sự hiểu biết, học tập và ghi nhớ",
    description: "Học tập hành vi (thuyết điều kiện cổ điển, thuyết điều kiện hoạt động) và học tập nhận thức (quan sát, lý luận). Các loại trí nhớ ngắn hạn và dài hạn."
  },

  // Chapter 5
  {
    id: "CB_T5.1",
    chapterId: 5,
    title: "Quy trình quyết định mua hàng truyền thống",
    description: "Hành trình 5 bước tuyến tính: Nhận biết nhu cầu, Tìm kiếm thông tin (trong/ngoài), So sánh đánh giá, Quyết định mua, Hành vi sau mua (mức độ hài lòng)."
  },
  {
    id: "CB_T5.2",
    chapterId: 5,
    title: "Nhận biết vấn đề và tìm kiếm thông tin",
    description: "Sự chênh lệch giữa trạng thái lý tưởng và trạng thái thực tế. Các kênh tìm kiếm bên ngoài: nhà bán lẻ, truyền thông xã hội, cá nhân, nguồn độc lập."
  },
  {
    id: "CB_T5.3",
    chapterId: 5,
    title: "Hành trình khách hàng thời đại kết nối (Mô hình 5A)",
    description: "Mô hình 5A phi tuyến tính của Kotler: Nhận biết (Aware), Thu hút (Appeal), Tìm hiểu (Ask), Hành động (Act), Ủng hộ (Advocate) và vai trò của cộng đồng."
  },

  // Chapter 6
  {
    id: "CB_T6.1",
    chapterId: 6,
    title: "Đặc thù thị trường và hành vi B2B",
    description: "Sự khác biệt căn bản giữa khách hàng tổ chức và khách hàng cá nhân. Phân loại 4 nhóm tổ chức: doanh nghiệp sản xuất, doanh nghiệp thương mại, nhà nước, các tổ chức khác."
  },
  {
    id: "CB_T6.2",
    chapterId: 6,
    title: "Kết cấu thị trường và đặc điểm nhu cầu tổ chức",
    description: "Nhu cầu phái sinh (bắt nguồn từ tiêu dùng cuối), cầu ít co giãn theo giá và cầu biến động mạnh. Sự tập trung cao độ về mặt địa lý."
  },
  {
    id: "CB_T6.3",
    chapterId: 6,
    title: "Sản phẩm và các dịch vụ hỗ trợ B2B",
    description: "Các nhóm sản phẩm tổ chức: nguyên liệu thô, thiết bị lắp đặt, vật tư phụ trợ và các dịch vụ đi kèm (bảo hiểm, tư vấn, bảo hành)."
  },

  // Chapter 7
  {
    id: "CB_T7.1",
    chapterId: 7,
    title: "Quy trình quyết định mua B2B 7 giai đoạn",
    description: "Khởi đầu từ Nhận thức nhu cầu, Xác định quy cách sản phẩm, Tìm nhà cung cấp, Yêu cầu chào hàng, Lựa chọn nhà cung cấp, Làm thủ tục đặt hàng, Đánh giá kết quả thực hiện."
  },
  {
    id: "CB_T7.2",
    chapterId: 7,
    title: "Phân loại tình huống mua hàng tổ chức",
    description: "Phân biệt 3 tình huống mua: Mua lặp lại không thay đổi (thông lệ), Mua lặp lại có thay đổi (giải quyết vấn đề giới hạn), Mua mới (giải quyết vấn đề mở rộng)."
  },
  {
    id: "CB_T7.3",
    chapterId: 7,
    title: "Trung tâm mua hàng và 6 vai trò ra quyết định",
    description: "Nghiên cứu nhóm ra quyết định chung (DMU) gồm: Người khởi xướng, Người gác cửa, Người ảnh hưởng, Người quyết định, Người mua, Người sử dụng."
  }
];

export const cbQuestions: Question[] = [
  {
    id: 2001,
    question: "Theo Kotler & Amstrong (2018), hành vi mua của người tiêu dùng là hành vi mua của:",
    options: {
      a: "Người tiêu dùng cuối cùng - cá nhân, hộ gia đình mua sản phẩm cho mục đích tiêu dùng cá nhân",
      b: "Doanh nghiệp mua sản phẩm để phục vụ sản xuất kinh doanh hoặc vận hành tổ chức",
      c: "Các trung gian thương mại mua sắm để bán lại kiếm lời",
      d: "Các cơ quan nhà nước mua sắm trang thiết bị phục vụ công ích"
    },
    correctAnswer: "a",
    chapterId: 1,
    topicId: "CB_T1.1",
    difficulty: "Dễ",
    difficultyRating: 2,
    explanation: "Hành vi mua của người tiêu dùng là hành vi mua của người tiêu dùng cuối cùng – các nhân, hộ gia đình mua sản phẩm và dịch vụ cho mục đích tiêu dùng cá nhân (Kotler & Amstrong, 2018).",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 5, trang 1",
    knowledgeMapping: ["Khái niệm", "Người tiêu dùng cuối cùng", "Kotler & Amstrong"],
    relatedQuestions: [2002],
    estimatedTime: 30,
    questionType: "multiple-choice",
    learningObjective: "Nắm vững định nghĩa chính thức về hành vi mua của người tiêu dùng."
  },
  {
    id: 2002,
    question: "Chiến dịch truyền thông quảng cáo bánh mỳ kẹp kiểu Việt Nam của Burger King với hình ảnh người phương Tây vất vả dùng đôi đũa to và dài để ăn Burger đã vi phạm nghiêm trọng yếu tố nào?",
    options: {
      a: "Chính sách giá cả sản phẩm địa phương",
      b: "Tiêu chuẩn vệ sinh an toàn thực phẩm",
      c: "Yếu tố văn hóa ăn uống bằng đũa của các quốc gia châu Á",
      d: "Hành vi mua sắm của nhóm né tránh (avoidance groups)"
    },
    correctAnswer: "c",
    chapterId: 2,
    topicId: "CB_T2.1",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Video của Burger King đã vấp phải làn sóng phản đối dữ dội vì người tiêu dùng châu Á cho rằng thương hiệu này xem thường văn hóa dùng đũa truyền thống, minh chứng cho việc không thấu hiểu văn hóa địa phương dẫn tới thất bại truyền thông.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 7, trang 1",
    knowledgeMapping: ["Văn hóa", "Sai lầm truyền thông", "Burger King"],
    relatedQuestions: [2001, 2003],
    estimatedTime: 45,
    questionType: "multiple-choice",
    learningObjective: "Thấu hiểu tầm quan trọng của việc nghiên cứu yếu tố văn hóa trong marketing."
  },
  {
    id: 2003,
    question: "Chứng nhận nào dưới đây chứng minh các sản phẩm thực phẩm, mỹ phẩm là 'sử dụng được', đáp ứng đúng tiêu chuẩn tôn giáo của người Hồi giáo?",
    options: {
      a: "Chứng nhận HACCP",
      b: "Chứng nhận ISO 9001",
      c: "Chứng nhận HALAL",
      d: "Chứng nhận FDA"
    },
    correctAnswer: "c",
    chapterId: 2,
    topicId: "CB_T2.1",
    difficulty: "Dễ",
    difficultyRating: 2,
    explanation: "Chứng nhận HALAL là chứng nhận bắt buộc đối với các doanh nghiệp muốn tiếp cận phân khúc khách hàng đạo Hồi để chứng minh sản phẩm không chứa chất cấm và quy trình sản xuất đạt tiêu chuẩn tôn giáo của họ.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 10, trang 2",
    knowledgeMapping: ["Nhánh văn hóa", "Tôn giáo", "Halal", "Đạo Hồi"],
    relatedQuestions: [2002],
    estimatedTime: 30,
    questionType: "multiple-choice",
    learningObjective: "Biết các tiêu chuẩn sản phẩm phù hợp với phân khúc tôn giáo đặc thù."
  },
  {
    id: 2004,
    question: "Vì sao thu nhập KHÔNG còn là yếu tố duy nhất quyết định giai tầng/tầng lớp xã hội trong hành vi tiêu dùng?",
    options: {
      a: "Vì mọi người có xu hướng chi tiêu tiết kiệm giống nhau khi xã hội phát triển",
      b: "Vì những người ở các giai tầng khác nhau (như sinh viên và công nhân) có thể có trình độ, sở thích và đòi hỏi chất lượng sản phẩm khác biệt dù thu nhập tương đương hoặc thấp hơn",
      c: "Vì tầng lớp xã hội chỉ được đo lường bằng biến số tài sản thừa kế vĩnh viễn",
      d: "Vì pháp luật không cho phép phân biệt đối xử dựa trên mức thu nhập cá nhân"
    },
    correctAnswer: "b",
    chapterId: 2,
    topicId: "CB_T2.2",
    difficulty: "Khó",
    difficultyRating: 4,
    explanation: "Tầng lớp xã hội được đo lường bởi sự kết hợp của nhiều biến số (nghề nghiệp, giáo dục, tài sản, thu nhập...). Sinh viên đại học chính quy tuy thu nhập hiện tại thấp hơn công nhân lành nghề nhưng lại yêu cầu chất lượng học thuật, sách vở, trang phục có chuẩn mực thẩm mỹ cao hơn.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 13, trang 3",
    knowledgeMapping: ["Tầng lớp xã hội", "Đo lường", "Thu nhập và hành vi"],
    relatedQuestions: [2001],
    estimatedTime: 50,
    questionType: "multiple-choice",
    learningObjective: "Phân biệt khái niệm tầng lớp xã hội với chỉ số thu nhập đơn thuần."
  },
  {
    id: 2005,
    question: "Chiến dịch 'Real Beauty' của Dove tôn vinh vẻ đẹp tự nhiên của phụ nữ thay vì các chuẩn mực hoàn hảo phi thực tế là ví dụ điển hình về việc ứng dụng khía cạnh nào trong quan niệm bản thân?",
    options: {
      a: "Bản ngã lý tưởng (Ideal Self)",
      b: "Bản ngã thực tế (Real Self / Actual Self)",
      c: "Bản ngã trong mắt người khác (Looking-glass Self)",
      d: "Nhóm né tránh (Avoidance groups)"
    },
    correctAnswer: "b",
    chapterId: 3,
    topicId: "CB_T3.3",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Chiến dịch của Dove đánh trúng 'Real Self' (Bản ngã thực tế) - cách phụ nữ nhìn nhận thực tế về cơ thể và vẻ đẹp tự nhiên của chính mình, tạo ra sự đồng cảm sâu sắc và gia tăng lòng trung thành thương hiệu.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 9-10, trang 37",
    knowledgeMapping: ["Quan niệm bản thân", "Bản ngã thực tế", "Dove"],
    relatedQuestions: [2006],
    estimatedTime: 40,
    questionType: "multiple-choice",
    learningObjective: "Hiểu ứng dụng của Bản ngã thực tế (Real Self) vào chiến dịch truyền thông."
  },
  {
    id: 2006,
    question: "Khi khách hàng mua sắm các sản phẩm cao cấp hoặc thương hiệu danh tiếng như Apple hay Mercedes-Benz để thể hiện địa vị và mong muốn người khác đánh giá cao mình hơn, hành vi này bị chi phối trực tiếp bởi:",
    options: {
      a: "Bản ngã thực tế (Real Self)",
      b: "Bản ngã lý tưởng (Ideal Self)",
      c: "Bản ngã trong mắt người khác (Looking-glass Self)",
      d: "Động cơ sinh lý bẩm sinh (Innate Needs)"
    },
    correctAnswer: "c",
    chapterId: 3,
    topicId: "CB_T3.3",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Bản ngã trong mắt người khác (Looking-glass Self) đề cập đến cách cá nhân nghĩ người khác nhìn nhận và đánh giá mình như thế nào. Khi dùng Apple hoặc xe Mercedes, người tiêu dùng muốn phát đi tín hiệu về địa vị xã hội thành đạt của mình.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 47, trang 47",
    knowledgeMapping: ["Quan niệm bản thân", "Looking-glass Self", "Apple", "Mercedes-Benz"],
    relatedQuestions: [2005],
    estimatedTime: 40,
    questionType: "multiple-choice",
    learningObjective: "Nhận biết hành vi tiêu dùng hướng tới địa vị xã hội thông qua Looking-glass Self."
  },
  {
    id: 2007,
    question: "Nhận thức (Perception) được định nghĩa là một quá trình cá nhân thực hiện các bước nào đối với kích thích xung quanh?",
    options: {
      a: "Mua sắm, sử dụng và loại bỏ",
      b: "Tiếp nhận (Exposure), chú ý (Attention) và diễn giải (Interpretation)",
      c: "Lập luận tư duy, bốc đồng cảm xúc và phản ứng sinh lý",
      d: "Nhớ lại ngắn hạn, ghi nhớ dài hạn và truy xuất thông tin"
    },
    correctAnswer: "b",
    chapterId: 4,
    topicId: "CB_T4.2",
    difficulty: "Dễ",
    difficultyRating: 2,
    explanation: "Nhận thức là quá trình một cá nhân lựa chọn (tiếp nhận), tổ chức (chú ý) và diễn giải các kích thích thành một bức tranh có ý nghĩa và mạch lạc về thế giới.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 15, trang 40",
    knowledgeMapping: ["Nhận thức", "Kích thích giác quan", "Quy trình nhận thức"],
    relatedQuestions: [2008],
    estimatedTime: 30,
    questionType: "multiple-choice",
    learningObjective: "Nắm vững 3 giai đoạn của quy trình nhận thức."
  },
  {
    id: 2008,
    question: "Trong kỹ thuật điều chỉnh giá cả hoặc khối lượng bao bì sản phẩm, việc các doanh nghiệp tăng giá nhẹ hoặc giảm bớt một chút trọng lượng sản phẩm sao cho khách hàng hầu như KHÔNG phát hiện ra sự khác biệt là ứng dụng lý thuyết nào?",
    options: {
      a: "Ngưỡng tuyệt đối (Absolute Threshold)",
      b: "Ngưỡng khác biệt (Differential Threshold / JND)",
      c: "Marketing lan truyền (Viral Marketing)",
      d: "Thuyết điều kiện cổ điển (Classical Conditioning)"
    },
    correctAnswer: "b",
    chapterId: 4,
    topicId: "CB_T4.2",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Ngưỡng khác biệt (JND) là sự khác biệt tối thiểu có thể phát hiện giữa hai kích thích tương tự nhau. Khi muốn tăng giá hoặc giảm chất lượng bao bì mà không làm mất lòng khách hàng, doanh nghiệp sẽ điều chỉnh dưới ngưỡng khác biệt.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 10, trang 39",
    knowledgeMapping: ["Ngưỡng khác biệt", "JND", "Chiến thuật định giá"],
    relatedQuestions: [2007],
    estimatedTime: 45,
    questionType: "multiple-choice",
    learningObjective: "Ứng dụng ngưỡng khác biệt vào các quyết định sản phẩm và giá cả thực tế."
  },
  {
    id: 2009,
    question: "Hành trình khách hàng thời đại kỹ thuật số 4.0 theo mô hình 5A của Philip Kotler (2021) bao gồm các bước theo thứ tự nào?",
    options: {
      a: "Nhận biết (Aware) -> Thu hút (Appeal) -> Tìm hiểu (Ask) -> Hành động (Act) -> Ủng hộ (Advocate)",
      b: "Chú ý (Attention) -> Quan tâm (Interest) -> Mong muốn (Desire) -> Hành động (Action)",
      c: "Tiếp xúc -> Thử nghiệm -> Mua sắm -> Đánh giá -> Trung thành",
      d: "Tìm kiếm -> So sánh -> Thương thảo -> Ký hợp đồng -> Nghiệm thu"
    },
    correctAnswer: "a",
    chapterId: 5,
    topicId: "CB_T5.3",
    difficulty: "Dễ",
    difficultyRating: 2,
    explanation: "Hành trình khách hàng trong thời đại kết nối diễn ra theo mô hình 5A (Kotler và cộng sự, 2021), bao gồm: Nhận biết, Thu hút, Tìm hiểu, Hành động và Ủng hộ. Hành trình này phi tuyến tính và chịu ảnh hưởng lớn từ cộng đồng mạng.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 5, trang 37",
    knowledgeMapping: ["Hành trình khách hàng", "Mô hình 5A", "Philip Kotler"],
    relatedQuestions: [],
    estimatedTime: 30,
    questionType: "multiple-choice",
    learningObjective: "Phân biệt mô hình hành trình 5A hiện đại với mô hình phễu truyền thống."
  },
  {
    id: 2010,
    question: "Đâu là một đặc điểm cốt lõi của nhu cầu trên thị trường tổ chức (B2B) so với thị trường tiêu dùng cá nhân (B2C)?",
    options: {
      a: "Nhu cầu vĩnh viễn và không bao giờ biến động",
      b: "Cầu phái sinh (Derived Demand) - bắt nguồn từ nhu cầu về sản phẩm tiêu dùng của người tiêu dùng cuối cùng",
      c: "Cầu có tính co giãn cực kỳ cao theo giá cả thị trường",
      d: "Số lượng người mua vô cùng lớn và phân tán khắp nơi về mặt địa lý"
    },
    correctAnswer: "b",
    chapterId: 6,
    topicId: "CB_T6.2",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Nhu cầu của thị trường tổ chức là nhu cầu có tính phát sinh (Derived Demand), bắt nguồn từ nhu cầu về sản phẩm tiêu dùng của người tiêu dùng cuối cùng. Ví dụ nhu cầu mua vải của công ty dệt may phụ thuộc trực tiếp vào nhu cầu quần áo của xã hội.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 14, trang 14",
    knowledgeMapping: ["Hành vi B2B", "Cầu phái sinh", "Đặc thù thị trường"],
    relatedQuestions: [2011, 2012],
    estimatedTime: 40,
    questionType: "multiple-choice",
    learningObjective: "Nắm vững thuộc tính cầu phái sinh đặc trưng của thị trường B2B."
  },
  {
    id: 2011,
    question: "Trong quy trình mua hàng tổ chức, tình huống nào đại diện cho việc doanh nghiệp đặt mua lại định kỳ các mặt hàng văn phòng phẩm, vật tư tiêu hao từ các nhà cung cấp quen thuộc mà hầu như KHÔNG có sự thay đổi điều chỉnh nào?",
    options: {
      a: "Mua mới (New task)",
      b: "Mua lặp lại có thay đổi (Modified rebuy)",
      c: "Mua lặp lại không thay đổi (Straight rebuy)",
      d: "Đấu thầu dự án công khai"
    },
    correctAnswer: "c",
    chapterId: 7,
    topicId: "CB_T7.2",
    difficulty: "Dễ",
    difficultyRating: 2,
    explanation: "Mua lặp lại không thay đổi (Straight rebuy) xảy ra khi việc mua sắm ít quan trọng, có tính thông lệ, người mua chỉ việc đặt hàng lại theo danh sách nhà cung cấp đã được phê duyệt sẵn từ trước.",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 4, trang 25",
    knowledgeMapping: ["Tình huống mua B2B", "Mua lặp lại không thay đổi", "Thủ tục thông lệ"],
    relatedQuestions: [2010, 2012],
    estimatedTime: 30,
    questionType: "multiple-choice",
    learningObjective: "Phân loại các tình huống mua sắm cơ bản trong doanh nghiệp."
  },
  {
    id: 2012,
    question: "Trong Trung tâm mua hàng (Decision Making Unit - DMU) của tổ chức, vai trò của 'Người gác cửa' (Gatekeepers) là gì?",
    options: {
      a: "Là người ký hợp đồng mua sắm chính thức với đối tác B2B",
      b: "Là người trực tiếp sử dụng máy móc, trang bị được mua về",
      c: "Là người kiểm soát luồng thông tin đi vào tổ chức, ví dụ lễ tân, thư ký phòng vật tư có thể ngăn cản nhân viên bán hàng tiếp cận người quyết định",
      d: "Là người duyệt chi ngân sách cuối cùng cho dự án"
    },
    correctAnswer: "c",
    chapterId: 7,
    topicId: "CB_T7.3",
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Người gác cửa (Gatekeepers) là chốt chặn đầu tiên kiểm soát dòng thông tin hoặc khả năng tiếp cận của các nhà cung ứng bên ngoài vào trung tâm mua hàng (ví dụ: nhân viên lễ tân, thư ký hành chính).",
    sourcePdf: "HanhViKhachHang.pdf",
    sourcePage: "Slide 6, trang 38",
    knowledgeMapping: ["Trung tâm mua", "Vai trò quyết định", "Người gác cửa"],
    relatedQuestions: [2010, 2011],
    estimatedTime: 40,
    questionType: "multiple-choice",
    learningObjective: "Thấu hiểu vai trò 'Người gác cửa' để có chiến lược tiếp cận telesales/bán hàng B2B hiệu quả."
  }
];
