/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Award, Brain, AlertTriangle, ChevronDown, ChevronUp, 
  Play, BookOpen, RefreshCw, Calendar, Sparkles, HelpCircle 
} from "lucide-react";
import { kbService, KnowledgeNode } from "../services/kbService";
import { dbService, questions } from "../services/db";
import { ExamAttempt } from "../types";

interface ConceptMasteryMapProps {
  onStartExam: (exam: ExamAttempt) => void;
}

export default function ConceptMasteryMap({ onStartExam }: ConceptMasteryMapProps) {
  const activeSubjectId = dbService.getActiveSubjectId();
  const graph = kbService.getKnowledgeGraph(activeSubjectId);
  const stats = dbService.getStatistics();
  const mastery = stats.conceptMastery || {};

  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);

  // Group concepts by chapter
  const chaptersMap: Record<number, KnowledgeNode[]> = {};
  graph.forEach(node => {
    if (!chaptersMap[node.chapter]) {
      chaptersMap[node.chapter] = [];
    }
    chaptersMap[node.chapter].push(node);
  });

  const getMasteryColor = (score: number) => {
    if (score >= 90) return "bg-brand-success text-brand-success-border";
    if (score >= 60) return "bg-brand-info text-brand-info-border";
    if (score > 0) return "bg-brand-warning text-brand-warning-border";
    return "bg-bg-surface text-text-muted";
  };

  const getMasteryLabel = (score: number) => {
    if (score >= 90) return "Tinh thông";
    if (score >= 60) return "Đạt chuẩn";
    if (score > 0) return "Đang học";
    return "Chưa bắt đầu";
  };

  const handlePracticeConcept = (node: KnowledgeNode) => {
    // Collect all questions containing this concept tag or topic
    let conceptQs = questions.filter(q => 
      q.topicId === node.topic || 
      q.knowledgeMapping?.some(tag => node.concept.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(node.concept.toLowerCase()))
    );

    if (conceptQs.length === 0) {
      // Fallback: take first 5 from the same chapter
      conceptQs = questions.filter(q => q.chapterId === node.chapter).slice(0, 5);
    }

    const qIds = conceptQs.map(q => q.id);

    // Build custom ExamAttempt
    const exam: ExamAttempt = {
      id: String(Date.now()),
      startTime: new Date().toISOString(),
      isSubmitted: false,
      score: 0,
      answers: {},
      questions: qIds,
      timeSpent: 0,
      bookmarks: [],
      flags: [],
      examType: "adaptive",
      chapterId: node.chapter,
      topicId: node.topic
    };

    dbService.saveAttempt(exam);
    onStartExam(exam);
  };

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl p-6 space-y-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)]" id="kb-mastery-map">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-primary/60 pb-5">
        <div className="space-y-1">
          <h3 className="text-md font-medium font-display text-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-text-muted animate-pulse" />
            <span>Bản đồ thông thạo khái niệm</span>
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed font-sans max-w-xl">
            Không chỉ chấm điểm, hệ thống theo dõi mức độ thông thạo của từng khái niệm trong tài liệu để cá nhân hóa lộ trình và tự động cảnh báo điều kiện tiên quyết.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-success inline-block"></span> ≥90% tinh thông</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-info inline-block"></span> ≥60% đạt chuẩn</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-warning inline-block"></span> &lt;60% còn yếu</span>
        </div>
      </div>

      {graph.length === 0 ? (
        <div className="text-center py-8 text-xs text-text-muted font-sans">
          Chưa có cơ sở tri thức cho học phần này. AI đang phân tích tài liệu để tự động thiết lập bản đồ thông thạo.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(chaptersMap).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([chIdStr, nodes]) => {
            const chId = parseInt(chIdStr);
            return (
              <div key={chId} className="space-y-3">
                <div className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono border-l-2 border-text-primary pl-2.5">
                  Chương {chId}: {nodes[0]?.source ? `${nodes[0].source.split(".pdf")[0] || "Bài học"}` : `Kiến thức Chương ${chId}`}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nodes.map(node => {
                    const score = mastery[node.id] ?? (mastery[node.concept] ?? 0);
                    const isExpanded = expandedConcept === node.id;
                    
                    // Verify prerequisites
                    const requires = node.dependencies?.requires || [];
                    const unmetPrereqs: string[] = [];
                    requires.forEach(reqId => {
                      const reqNode = graph.find(g => g.id === reqId);
                      const reqMastery = mastery[reqId] ?? 0;
                      if (reqMastery < 60 && reqNode) {
                        unmetPrereqs.push(reqNode.concept);
                      }
                    });

                    return (
                      <div 
                        key={node.id} 
                        className={`border rounded-xl transition duration-150 p-4 space-y-3.5 relative overflow-hidden bg-bg-card hover:bg-bg-surface/30 ${
                          unmetPrereqs.length > 0 ? "border-brand-warning/30 bg-brand-warning-bg/5" : "border-border-primary/80"
                        }`}
                      >
                        {/* Concept Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] text-text-muted font-mono font-medium block">
                              Mã tri thức: {node.id}
                            </span>
                            <h4 className="text-xs font-semibold text-text-primary leading-tight font-sans">
                              {node.concept}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {unmetPrereqs.length > 0 && (
                              <div className="p-1 rounded-md bg-brand-warning-bg text-brand-warning" title="Khái niệm tiên quyết chưa đạt chuẩn 60%">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium font-sans ${
                              score >= 90 ? "bg-brand-success-bg text-brand-success border border-brand-success-border/30" :
                              score >= 60 ? "bg-brand-info-bg text-brand-info border border-brand-info-border/30" :
                              score > 0 ? "bg-brand-warning-bg text-brand-warning border border-brand-warning-border/30" :
                              "bg-bg-surface text-text-muted border border-border-primary/60"
                            }`}>
                              {score}% thông thạo
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="w-full bg-bg-surface h-1.5 rounded-full overflow-hidden border border-border-primary/40">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                score >= 90 ? "bg-brand-success" :
                                score >= 60 ? "bg-brand-info" :
                                score > 0 ? "bg-brand-warning" : "bg-bg-card"
                              }`}
                              style={{ width: `${score}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-text-muted font-sans">
                            <span>{getMasteryLabel(score)}</span>
                            {node.review?.reviewPriority === "high" && (
                              <span className="text-brand-danger flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3" /> Ôn tập ưu tiên
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Unmet prerequisites Alert */}
                        {unmetPrereqs.length > 0 && (
                          <div className="bg-brand-warning-bg border border-brand-warning-border/40 p-2.5 rounded-lg text-[10px] text-brand-warning-text leading-relaxed font-sans flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <div>
                              <strong>Cảnh báo tiên quyết:</strong> Hãy ôn luyện đạt ≥60% khái niệm gốc <strong>{unmetPrereqs.join(", ")}</strong> trước để hiểu sâu bài học này hơn.
                            </div>
                          </div>
                        )}

                        {/* Expandable details */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-border-primary/60 space-y-3 text-[11px] text-text-secondary leading-relaxed font-sans animate-fade-in">
                            <div className="space-y-1">
                              <span className="text-text-muted font-semibold uppercase tracking-wider text-[9px] block">Định nghĩa tài liệu chính thức:</span>
                              <p className="whitespace-pre-line text-text-primary bg-bg-surface p-2.5 rounded-lg border border-border-primary/40">{node.definition}</p>
                            </div>
                            
                            {node.teaching?.misconception && (
                              <div className="space-y-1">
                                <span className="text-brand-danger font-semibold uppercase tracking-wider text-[9px] block">Lỗi sai học viên thường mắc:</span>
                                <p className="text-text-secondary bg-brand-danger-bg/20 border border-brand-danger-border/20 p-2.5 rounded-lg">{node.teaching.misconception}</p>
                              </div>
                            )}

                            {node.teaching?.memoryHook && (
                              <div className="space-y-1">
                                <span className="text-brand-success font-semibold uppercase tracking-wider text-[9px] block">Mẹo ghi nhớ nhanh:</span>
                                <p className="text-brand-success bg-brand-success-bg/10 border border-brand-success-border/20 p-2.5 rounded-lg italic">"{node.teaching.memoryHook}"</p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-text-muted pt-1">
                              <div>Slide nguồn: {node.source || "Tài liệu môn"}</div>
                              <div>Trang số: {node.page || "N/A"}</div>
                            </div>
                          </div>
                        )}

                        {/* Footer Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <button 
                            onClick={() => setExpandedConcept(isExpanded ? null : node.id)}
                            className="text-[10px] text-text-muted hover:text-text-primary font-medium flex items-center gap-1.5 transition duration-150 cursor-pointer"
                          >
                            {isExpanded ? (
                              <><span>Thu gọn</span><ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <><span>Chi tiết tri thức</span><ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>

                          <button 
                            onClick={() => handlePracticeConcept(node)}
                            className="bg-bg-surface hover:bg-border-primary/80 text-text-secondary hover:text-text-primary border border-border-primary/80 font-medium text-[10px] px-3 py-1 rounded-lg transition duration-150 flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-2.5 h-2.5 text-text-muted" />
                            <span>Luyện tập</span>
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
