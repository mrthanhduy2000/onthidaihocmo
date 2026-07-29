/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Modal tạo sinh câu hỏi bằng AI cho ĐÚNG một chương chỉ định.
 * Dùng lại trong Trung tâm Rèn luyện để nối thẳng tính năng tạo sinh với luyện đề theo chương:
 * người học dán nội dung/tóm tắt của chương, AI soạn câu và toàn bộ được gán về đúng chương đó.
 */
import React, { useState } from "react";
import { Sparkles, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { aiService } from "../services/ai";
import { dbService } from "../services/db";

/**
 * Khi người dùng KHÔNG dán nội dung mới, tự tổng hợp "nguồn" từ chính ngân hàng câu hỏi
 * của chương đó (khái niệm, mục tiêu học, lời giải) để AI có cơ sở soạn thêm câu mới,
 * thay vì bắt người dùng dán lại tài liệu.
 */
function buildSourceFromChapter(chapterId: number): string {
  const qs = dbService.getQuestions().filter((q) => q.chapterId === chapterId);
  if (qs.length === 0) return "";
  const parts = qs.slice(0, 60).map((q) => {
    const bits = [q.concept, q.learningObjective, q.explanation].filter(Boolean);
    return bits.join(". ");
  });
  return parts.join("\n\n");
}

interface Props {
  chapterId: number;
  chapterTitle: string;
  onClose: () => void;
  /** Gọi khi tạo xong để màn cha tải lại số liệu ngân hàng câu hỏi. */
  onDone: () => void;
}

export default function ChapterQuestionGeneratorModal({ chapterId, chapterTitle, onClose, onDone }: Props) {
  const [materialText, setMaterialText] = useState("");
  const [genCount, setGenCount] = useState<number>(10);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("Sẵn sàng");
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const [note, setNote] = useState("");

  const handleGenerate = async () => {
    // Nếu để trống ô dán, tự tổng hợp nguồn từ ngân hàng câu hỏi sẵn có của chương.
    let text = materialText.trim();
    let usedExisting = false;
    if (!text) {
      text = buildSourceFromChapter(chapterId);
      usedExisting = true;
      if (!text) {
        setError("Chương này chưa có câu hỏi nào để AI dựa vào. Hãy dán một ít nội dung của chương.");
        return;
      }
    }
    setError("");
    setNote("");
    setIsBusy(true);
    setProgress(5);
    setStep("Đang chuẩn bị tài liệu...");

    try {
      const title = `Chương ${chapterId} - ${chapterTitle}`;
      const result = await aiService.generateQuestionBankFromText(
        text,
        genCount,
        title,
        (batchDone, totalBatches, accumulated) => {
          const pct = totalBatches > 0 ? Math.round((batchDone / totalBatches) * 100) : 0;
          setProgress(Math.max(5, Math.min(99, pct)));
          setStep(
            batchDone >= totalBatches
              ? "Đang lưu vào ngân hàng câu hỏi..."
              : `AI đang soạn lượt ${batchDone + 1}/${totalBatches} (đã có ${accumulated} câu)...`
          );
        },
        chapterId
      );

      const notes: string[] = [];
      if (result.added < result.requested) {
        notes.push(`Mới đạt ${result.added}/${result.requested} câu; dán thêm nội dung dài hơn để tạo nhiều hơn.`);
      }
      if (result.duplicatesSkipped > 0) notes.push(`Đã bỏ ${result.duplicatesSkipped} câu trùng lặp.`);
      if (result.failedBatches > 0) notes.push(`Có ${result.failedBatches} lượt AI lỗi (đã bỏ qua).`);
      if (usedExisting) notes.push("Đã tự sinh thêm từ nội dung chương có sẵn (bạn không cần dán tài liệu).");
      setNote(notes.join(" "));

      setProgress(100);
      setAddedCount(result.added);
      setIsBusy(false);
      onDone();
    } catch (e: any) {
      setIsBusy(false);
      setProgress(0);
      setError(e?.message || "Có lỗi khi tạo câu hỏi. Vui lòng thử lại.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bg-card border border-border-primary rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border-primary pb-3">
          <h3 className="text-xs tabular-nums text-text-primary">
Tạo câu hỏi AI cho Chương {chapterId}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {addedCount > 0 ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-brand-success-bg text-brand-success flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">Đã thêm {addedCount} câu vào Chương {chapterId}</p>
              <p className="text-xs text-text-muted">
                Bạn có thể giải đề riêng chương này ngay để củng cố kiến thức.
              </p>
              {note && <p className="text-2xs text-brand-warning pt-1">{note}</p>}
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => { setAddedCount(0); setMaterialText(""); setProgress(0); setStep("Sẵn sàng"); }}
                className="px-3.5 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-xl cursor-pointer"
              >
                Tạo tiếp
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-brand-info-bg border border-brand-info/20 rounded-xl text-2xs text-text-muted">
                Câu hỏi tạo ra sẽ được gán trọn vào <strong className="text-brand-info">Chương {chapterId} - {chapterTitle}</strong>.
              </div>

              <div>
                <label className="text-text-muted block mb-1">
                  Dán nội dung của chương (tùy chọn)
                </label>
                <textarea
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  rows={6}
                  placeholder="Để trống: AI tự soạn thêm câu mới từ nội dung chương đã có. Hoặc dán tài liệu mới để AI bám sát tài liệu đó."
                  className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-text-primary focus:outline-none resize-y leading-relaxed"
                />
                <div className="text-2xs text-text-muted mt-1 tabular-nums">
                  {materialText.trim().length > 0
                    ? `${materialText.trim().length.toLocaleString("vi-VN")} ký tự`
                    : "Để trống cũng được — AI sẽ tự sinh thêm từ ngân hàng câu hỏi của chương này."}
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Số câu muốn tạo</label>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 20, 40].map((n) => (
                    <button
                      key={n}
                      onClick={() => setGenCount(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                        genCount === n
                          ? "bg-brand-info-bg text-brand-info border-brand-info/40"
                          : "bg-bg-surface text-text-muted border-border-primary hover:text-text-primary"
                      }`}
                    >
                      {n} câu
                    </button>
                  ))}
                </div>
              </div>

              {isBusy && (
                <div className="p-3 bg-bg-surface border border-border-primary rounded-xl space-y-2 tabular-nums">
                  <div className="flex justify-between text-2xs text-brand-info">
                    <span>{step}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-bg-card border border-border-primary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-info h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-brand-error-bg border border-brand-error-border/40 rounded-xl text-2xs text-brand-error flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                disabled={isBusy}
                onClick={handleGenerate}
                className="px-4 py-1.5 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
              >
                {isBusy ? (
                  "Đang tạo..."
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Tạo {genCount} câu
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
