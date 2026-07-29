/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface SimpleMarkdownProps {
  text?: string;
  content?: string;
}

export default function SimpleMarkdown({ text, content }: SimpleMarkdownProps) {
  const markdownText = text || content || "";
  if (!markdownText) return null;
  const lines = markdownText.split("\n");
  return (
    <div className="space-y-2 text-text-secondary text-sm leading-relaxed">
      {lines.map((line, idx) => {
        let processed = line;
        
        // Headers
        if (processed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-medium text-text-primary text-sm mt-4 mb-2">
              {processed.replace("### ", "")}
            </h4>
          );
        }
        if (processed.startsWith("## ")) {
          return (
            <h3 key={idx} className="font-medium text-text-primary text-base mt-5 mb-2">
              {processed.replace("## ", "")}
            </h3>
          );
        }
        if (processed.startsWith("# ")) {
          return (
            <h2 key={idx} className="font-medium text-text-primary text-lg mt-6 mb-3">
              {processed.replace("# ", "")}
            </h2>
          );
        }

        // Bullet point & numbered lists
        const isBullet = processed.startsWith("- ") || processed.startsWith("* ") || !!processed.match(/^\d+\.\s/);
        let listPrefix = "";
        if (processed.startsWith("- ") || processed.startsWith("* ")) {
          processed = processed.substring(2);
          listPrefix = "•";
        } else if (processed.match(/^\d+\.\s/)) {
          const match = processed.match(/^(\d+\.)\s/);
          if (match) {
            listPrefix = match[1];
            processed = processed.substring(match[1].length + 1);
          }
        }

        // Bold matches
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(processed)) !== null) {
          if (match.index > lastIndex) {
            parts.push(processed.substring(lastIndex, match.index));
          }
          parts.push(
            <strong key={match.index} className="font-semibold text-text-primary">
              {match[1]}
            </strong>
          );
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < processed.length) {
          parts.push(processed.substring(lastIndex));
        }

        const content = parts.length > 0 ? parts : processed;

        if (listPrefix !== "" || isBullet) {
          return (
            <div key={idx} className="flex gap-2 pl-4">
              <span className="text-text-muted font-medium tabular-nums">{listPrefix || "•"}</span>
              <span className="flex-1">{content}</span>
            </div>
          );
        }

        return <p key={idx} className={line.trim() === "" ? "h-2" : "my-1"}>{content}</p>;
      })}
    </div>
  );
}
