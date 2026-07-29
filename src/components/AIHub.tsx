/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, RefreshCw, Play, Lock, Unlock } from "lucide-react";
import { dbService, chapters } from "../services/db";
import { aiService } from "../services/ai";
import { kbService, KnowledgeNode } from "../services/kbService";
import { TimeService } from "../services/time";
import { AIRecommendation, ExamAttempt } from "../types";
import SimpleMarkdown from "./SimpleMarkdown";
import TeachingAnalyticsView from "./TeachingAnalyticsView";
import LearningEvolutionView from "./LearningEvolutionView";
import ConceptMasteryMap from "./ConceptMasteryMap";

interface AIHubProps {
  key?: any;
  onStartExam: (exam: ExamAttempt) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
}

export default function AIHub({ onStartExam }: AIHubProps) {
  const [activeTab, setActiveTab] = useState<"roadmap" | "memory" | "weakness" | "chat" | "analytics">("roadmap");

  const [rec, setRec] = useState<AIRecommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState<boolean>(false);

  // Chat state
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "welcome-chat",
      sender: "ai",
      text: `Xin chào! Tôi là trợ lý học tập cho môn **${dbService.getActiveSubjectName()}**. Bạn có thể hỏi về lý thuyết, lỗi hay gặp hoặc cách ôn trước kỳ thi.`,
      time: TimeService.formatTime().substring(0, 5)
    }
  ]);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const localDiagnostic = aiService.generateLocalRecommendation();
    setRec(localDiagnostic);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loadingChat]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || loadingChat) return;

    const userText = chatInput.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: userText,
      time: TimeService.formatTime().substring(0, 5)
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setLoadingChat(true);

    try {
      const responseText = await aiService.askTutorQuestion(userText);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: responseText,
        time: TimeService.formatTime().substring(0, 5)
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        /*
          TRẠNG THÁI LỖI ĐANG ĐỘI LỐT TRẠNG THÁI CHỜ.

          Đây là nhánh `catch`, tức lời gọi AI ĐÃ THẤT BẠI. Nhưng câu cũ "Hệ thống đang xử lý
          câu hỏi" nói ngược hẳn: nó báo rằng việc vẫn đang chạy. Người học đọc xong sẽ ngồi
          chờ một câu trả lời không bao giờ tới, thay vì thử lại ngay.

          Một trạng thái lỗi phải nói ba điều: chuyện gì đã xảy ra, vì sao, và làm gì tiếp.
        */
        text: "Chưa gửi được câu hỏi tới gia sư AI, có thể do mạng. Bạn thử gửi lại nhé.",
        time: TimeService.formatTime().substring(0, 5)
      };
      setChatHistory(prev => [...prev, fallbackMsg]);
    } finally {
      setLoadingChat(false);
    }
  };

  const graph = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());
  const stats = dbService.getStatistics();
  const mastery = stats.conceptMastery || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 fade-in-up">
      {/* AI Coach Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-primary pb-6">
        {/*
          Một tiêu đề, không phải hai. Đây là màn thứ BA gặp đúng lỗi này trong đợt (sau Báo cáo
          và Kế hoạch): một dòng nhãn tô xanh dương nằm trên tiêu đề thật, nói lại chính việc mà
          tiêu đề đã nói, và mang màu của liên kết nên mời bấm vào chỗ không bấm được.

          Ghi lại thành khuôn để các màn còn lại khỏi lặp: **mỗi màn đúng một tiêu đề, một màu,
          viết như câu tiếng Việt, kèm một dòng nói màn này làm được gì cho người học.**
        */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold font-sans text-text-primary">
            Hỏi bài và nhận gợi ý ôn tập
          </h1>
          <p className="text-base text-text-secondary font-sans max-w-[40rem]">
            Theo dõi phần đã nắm, phần còn yếu và gợi ý bước học tiếp theo.
          </p>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-1 bg-bg-card p-1 rounded-xl border border-border-primary text-xs">
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === "roadmap" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Lộ trình
          </button>
          <button
            onClick={() => setActiveTab("memory")}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === "memory" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Trí nhớ
          </button>
          <button
            onClick={() => setActiveTab("weakness")}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === "weakness" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Vùng điểm yếu
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === "chat" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Hỏi đáp
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              activeTab === "analytics" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Phân tích
          </button>
        </div>
      </div>

      {/* TAB 1: VISUAL ROADMAP GRAPH */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-primary/60 pb-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
Sơ đồ khái niệm và kiến thức nền
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Xem các khái niệm liên quan với nhau và nên ôn phần nào trước.
                </p>
              </div>
            </div>

            {/* Visual Graph Hierarchy Flow */}
            <div className="space-y-6">
              {chapters.map((ch, idx) => {
                const chNodes = graph.filter(n => n.chapter === ch.id);
                const isUnlocked = idx === 0 || (graph.filter(n => n.chapter === ch.id - 1 && (mastery[n.concept] || 0) >= 60).length > 0);

                return (
                  <div key={ch.id} className="relative pl-6 border-l-2 border-border-primary/80 space-y-3">
                    {/* Node Circle Pin */}
                    <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold tabular-nums ${
                      isUnlocked 
                        ? "bg-brand-info-bg border-brand-info text-brand-info" 
                        : "bg-bg-surface border-border-primary text-text-muted"
                    }`}>
                      {isUnlocked ? <Unlock className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
                    </div>

                    {/*
                      Chip trạng thái phải `whitespace-nowrap shrink-0`: trên điện thoại nó nằm
                      cùng hàng với tên chương và không có gì chặn co lại, nên "Cần ôn chương
                      trước" bị bóp thành BA dòng chữ vụn. Nay chip giữ nguyên một dòng, phần
                      nhường chỗ là tên chương (`min-w-0` cho phép nó co và cắt cụt gọn gàng).
                    */}
                    <div className="flex items-start justify-between gap-3">
                      {/*
                        Tên chương nâng từ 13px lên 20px đậm 700. Đo trên trang khoá học của
                        Khan: tiêu đề một nhóm bài là **24px đậm 700**, còn từng bài bên dưới
                        mới là 14px. Bản cũ đảo ngược quan hệ đó, tên chương chỉ 13px trong khi
                        thẻ khái niệm bên dưới lại có nền và viền nên nặng hơn hẳn tên chương.

                        Bỏ luôn dòng "Chương {ch.id}" phía trên, vì `ch.title` đã bắt đầu bằng
                        đúng chuỗi "Chương N:" rồi. Cùng lỗi in trùng tiền tố đã sửa ở màn Câu
                        sai ngày hôm nay.
                      */}
                      <div className="min-w-0">
                        <h4 className="text-xl font-bold text-text-primary font-sans leading-snug">{ch.title}</h4>
                      </div>
                      <span className={`text-2xs tabular-nums px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                        isUnlocked ? "bg-brand-success-bg text-brand-success border-brand-success/20" : "bg-bg-surface text-text-muted border-border-primary"
                      }`}>
                        {isUnlocked ? "Đã đủ điều kiện" : "Cần ôn chương trước"}
                      </span>
                    </div>

                    {/*
                      KHÁI NIỆM DỰNG LẠI THÀNH HÀNG, KHÔNG CÒN LÀ THẺ.

                      Đo trực tiếp trên trang khoá học của Khan Academy ngày 29/07/2026, mỗi kỹ
                      năng của họ là một hàng: **cao đúng 24px, chữ 14px đậm 400 màu liên kết
                      `#1865F2`, nền trong suốt, viền 0, bo góc 0, đệm 0**, kèm một biểu tượng
                      nhỏ bên trái. Không thẻ, không nền xám, không nút riêng cho từng mục.

                      Bản cũ ở đây là **thẻ trong thẻ trong thẻ**: thẻ bọc ngoài có viền và bo
                      16px, bên trong là khối chương, bên trong nữa là lưới thẻ khái niệm nền
                      xám có viền, và trong mỗi thẻ ấy lại còn một cái nút có viền riêng. Bốn
                      tầng khung cho một danh sách khái niệm.

                      Ba điều đổi:

                      1. **Cả hàng là chỗ bấm**, thay cho một cái nút riêng nằm trong mỗi thẻ.
                         Chức năng giữ nguyên: vẫn gọi đúng `aiService.generateExam` với đúng
                         `chapterId` cũ. Vùng bấm rộng ra bằng cả hàng thay vì một cái nút nhỏ.
                      2. **Bỏ `line-clamp-2`.** Định nghĩa khái niệm đang bị cắt giữa từ, cho ra
                         "...sản phẩm, dịch..." và "...một xã hội lớn và phứ...". Một định nghĩa
                         cụt giữa từ thì vừa không đọc được vừa không đáng tin. Nay để chữ tự
                         xuống dòng trong một cột hẹp vừa tầm đọc.
                      3. **Số phần trăm thôi đứng trước tên khái niệm.** Bản cũ đặt "45% nắm
                         chắc" ở góc trên bên phải, tô đậm, tức mắt chạm con số trước khi chạm
                         tên khái niệm. Nay tên khái niệm đứng đầu hàng, phần trăm lùi về sau
                         dưới dạng chữ thường, đúng nguyên tắc đã áp cho các màn trước: nội
                         dung là chủ thể, số liệu là chú thích.
                    */}
                    <div className="pt-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
                      {chNodes.map(node => {
                        const score = mastery[node.concept] || 0;

                        return (
                          <button
                            key={node.id}
                            onClick={() => {
                              const exam = aiService.generateExam({ type: "chapter", chapterId: ch.id, count: 5 });
                              onStartExam(exam);
                            }}
                            className="w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-bg-surface transition cursor-pointer group flex items-start gap-3"
                          >
                            <Play className="w-4 h-4 mt-1 shrink-0 fill-current text-[color:var(--nut-chinh)]" />
                            <span className="min-w-0 space-y-1">
                              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                <span className="text-base font-medium text-[color:var(--nut-chinh)] group-hover:underline">
                                  {node.concept}
                                </span>
                                <span className="text-sm text-text-muted">{score}% nắm chắc</span>
                              </span>
                              <span className="block text-sm text-text-secondary leading-relaxed max-w-[42rem]">
                                {node.definition}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEMORY & DIGITAL TWIN */}
      {activeTab === "memory" && (
        <div className="space-y-6">
          <LearningEvolutionView />
        </div>
      )}

      {/* TAB 3: WEAK CONCEPTS & REMEDIATION */}
      {activeTab === "weakness" && (
        <div className="space-y-6">
          <ConceptMasteryMap onStartExam={onStartExam} />
        </div>
      )}

      {/* TAB 4: AI TUTOR CHAT */}
      {activeTab === "chat" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-bg-surface border-b border-border-primary flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-info-bg text-brand-info flex items-center justify-center font-bold">
              <Bot className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Trợ lý Hỏi đáp Học thuật AI</h3>
              <p className="text-2xs text-text-muted">Được huấn luyện trực tiếp trên giáo trình chuẩn</p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  msg.sender === "user" ? "bg-nut-chinh text-white font-bold" : "bg-brand-info-bg text-brand-info font-bold"
                }`}>
                  {msg.sender === "user" ? "U" : <Bot className="w-4 h-4 shrink-0" />}
                </div>

                <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-nut-chinh text-white font-medium" 
                    : "bg-bg-surface border border-border-primary text-text-primary"
                }`}>
                  <SimpleMarkdown content={msg.text} />
                  <div className={`text-2xs mt-1.5 tabular-nums ${msg.sender === "user" ? "text-bg-card/70 text-right" : "text-text-muted"}`}>
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex items-center gap-2 text-xs text-text-muted italic">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-info shrink-0" />
                <span>Gia sư AI đang suy luận câu trả lời...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 bg-bg-surface border-t border-border-primary space-y-2">
            {/* Quick Prompt Chips for Teacher Conversation Flow */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-2xs tabular-nums text-text-muted shrink-0">Hỏi nhanh:</span>
              {[
                "Giải thích đơn giản hơn",
                "Cho ví dụ thực tế khác",
                "So sánh với khái niệm này",
                "Đặt 3 câu hỏi kiểm tra",
                "Tiếp tục học phần"
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setChatInput(chip);
                  }}
                  className="px-2.5 py-1 text-2xs bg-bg-card hover:bg-bg-surface border border-border-primary rounded-full text-text-muted hover:text-text-primary whitespace-nowrap transition cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Hỏi AI Coach về bất kỳ khái niệm nào..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 bg-bg-card border border-border-primary rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary/20"
              />
              <button
                onClick={handleSendMessage}
                disabled={loadingChat || !chatInput.trim()}
                className="px-4 py-2 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <Send className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ADVANCED TEACHING ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <TeachingAnalyticsView />
        </div>
      )}
    </div>
  );
}
