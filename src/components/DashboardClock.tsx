/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { TimeService } from "../services/time";

export default function DashboardClock() {
  const [currentTime, setCurrentTime] = useState<Date>(TimeService.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(TimeService.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeStr = TimeService.formatTime(currentTime);
  const dateStr = TimeService.formatDate(currentTime);

  // Determine weekday in Vietnamese
  const dayOfWeek = TimeService.getCurrentWeek();
  const dayNames = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy"
  ];
  const weekdayStr = dayNames[dayOfWeek] || "Thứ Hai";

  return (
    <div id="dashboard-clock" className="bg-bg-surface/40 hover:bg-bg-surface/70 border border-border-primary/60 rounded-xl px-3.5 py-2 flex items-center gap-3 select-none transition duration-150">
      <div className="p-1.5 bg-bg-card rounded-lg shrink-0 border border-border-primary/50 shadow-3xs">
        <Clock className="w-4 h-4 text-brand-info animate-pulse" />
      </div>
      <div className="flex flex-col min-w-[130px]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold font-mono tracking-wider text-text-primary">
            {timeStr}
          </span>
          <span className="text-2xs text-text-muted font-medium">
            {weekdayStr}
          </span>
        </div>
        <div className="flex justify-between items-center text-2xs text-text-muted font-mono mt-0.5">
          <span>{dateStr}</span>
          <span className="text-2xs text-brand-info font-medium uppercase tracking-tight">
            TP. Hồ Chí Minh
          </span>
        </div>
      </div>
    </div>
  );
}
