/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, Sparkles, Send, Bot, RefreshCw, ChevronRight, 
  AlertTriangle, Play, BookOpen, Lock, Unlock, CheckCircle2, 
  TrendingUp, Award, Layers, HelpCircle, FileText
} from "lucide-react";
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
        text: "Hệ thống đang xử lý câu hỏi. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.",
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
        <div>
          <div className="flex items-center gap-2 text-xs tabular-nums text-brand-info mb-1">
            <Brain className="w-4 h-4" />
            Trợ lý học tập • Lộ trình cá nhân
          </div>
          <h1 className="text-2xl font-display font-light text-text-primary">
            Hỏi bài và nhận gợi ý ôn tập
          </h1>
          <p className="text-text-muted text-xs font-sans mt-1">
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
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-brand-info" />
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
                      {isUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/*
                      Chip trạng thái phải `whitespace-nowrap shrink-0`: trên điện thoại nó nằm
                      cùng hàng với tên chương và không có gì chặn co lại, nên "Cần ôn chương
                      trước" bị bóp thành BA dòng chữ vụn. Nay chip giữ nguyên một dòng, phần
                      nhường chỗ là tên chương (`min-w-0` cho phép nó co và cắt cụt gọn gàng).
                    */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-2xs tabular-nums text-brand-info">Chương {ch.id}</span>
                        <h4 className="text-sm font-semibold text-text-primary">{ch.title}</h4>
                      </div>
                      <span className={`text-2xs tabular-nums px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                        isUnlocked ? "bg-brand-success-bg text-brand-success border-brand-success/20" : "bg-bg-surface text-text-muted border-border-primary"
                      }`}>
                        {isUnlocked ? "Đã đủ điều kiện" : "Cần ôn chương trước"}
                      </span>
                    </div>

                    {/* Nodes inside Chapter */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {chNodes.map(node => {
                        const score = mastery[node.concept] || 0;
                        const statusColor = score >= 90 ? "border-brand-success/60 text-brand-success" : score >= 60 ? "border-brand-info/60 text-brand-info" : "border-border-primary text-text-muted";

                        return (
                          <div 
                            key={node.id} 
                            className="bg-bg-surface border border-border-primary hover:border-brand-info/50 rounded-xl p-3.5 transition space-y-2"
                          >
                            <div className="flex items-center justify-end text-2xs">
                              <span className={`tabular-nums font-bold ${statusColor}`}>{score}% nắm chắc</span>
                            </div>
                            <h5 className="text-xs font-semibold text-text-primary leading-snug">{node.concept}</h5>
                            <div className="text-2xs text-text-muted line-clamp-2">{node.definition}</div>
                            
                            <button
                              onClick={() => {
                                const exam = aiService.generateExam({ type: "chapter", chapterId: ch.id, count: 5 });
                                onStartExam(exam);
                              }}
                              className="w-full mt-2 py-1.5 px-2 bg-bg-card hover:bg-bg-surface border border-border-primary rounded-lg text-2xs font-medium text-text-primary transition flex items-center justify-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current text-brand-info" />
                              <span>Ôn khái niệm này</span>
                            </button>
                          </div>
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
              <Bot className="w-5 h-5" />
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
                  msg.sender === "user" ? "bg-text-primary text-bg-app font-bold" : "bg-brand-info-bg text-brand-info font-bold"
                }`}>
                  {msg.sender === "user" ? "U" : <Bot className="w-4 h-4" />}
                </div>

                <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-text-primary text-bg-card font-medium" 
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
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-info" />
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
                className="px-4 py-2 bg-text-primary text-bg-card hover:opacity-95 rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
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
