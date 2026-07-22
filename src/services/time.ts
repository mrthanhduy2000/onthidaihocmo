/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TimeService - Centralized, secure system time management.
 * Standardized on Asia/Ho_Chi_Minh timezone (UTC+7).
 * Monotonic protection against OS clock cheating / manual timezone modifications using performance.now().
 */

const CACHED_OFFSET_KEY = "poly_econ_time_offset";

// Initial fallback offset and system boot state
let cachedOffset = 0;
try {
  const saved = localStorage.getItem(CACHED_OFFSET_KEY);
  if (saved) {
    cachedOffset = parseInt(saved, 10) || 0;
  }
} catch {
  // Ignore localStorage errors in restricted environments
}

const appBootSystemTime = Date.now();
let appBootStandardTime = appBootSystemTime + cachedOffset;
const appBootPerformanceTime = performance.now();

/**
 * Returns the timezone-aligned and synchronized date.
 * Relies on monotonic performance.now() to protect against clock adjustments after boot.
 */
function getAccurateNow(): Date {
  const elapsedSinceBoot = performance.now() - appBootPerformanceTime;
  return new Date(appBootStandardTime + elapsedSinceBoot);
}

// Perform non-blocking network time synchronization on service start
async function syncTimeWithNetwork() {
  const apis = [
    "https://worldtimeapi.org/api/timezone/Asia/Ho_Chi_Minh",
    "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Ho_Chi_Minh",
    "https://httpbin.org/date"
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(api, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      let standardTimeMs = 0;
      if (api.includes("worldtimeapi.org")) {
        const data = await response.json();
        if (data && data.unixtime) {
          standardTimeMs = data.unixtime * 1000;
        }
      } else if (api.includes("timeapi.io")) {
        const data = await response.json();
        if (data && data.dateTime) {
          standardTimeMs = new Date(data.dateTime).getTime();
        }
      } else if (api.includes("httpbin.org")) {
        const data = await response.json();
        if (data && data.date) {
          standardTimeMs = new Date(data.date).getTime();
        }
      }

      if (standardTimeMs > 0) {
        const systemNow = Date.now();
        const currentOffset = standardTimeMs - systemNow;
        
        // Update runtime boot clock
        appBootStandardTime = appBootSystemTime + currentOffset;
        
        // Save offset for future offline use
        try {
          localStorage.setItem(CACHED_OFFSET_KEY, currentOffset.toString());
        } catch {
          // Ignore
        }
        
        console.log(`[TimeService] Synchronized standard time. Network offset: ${currentOffset}ms`);
        break; // Successfully synced
      }
    } catch (e) {
      console.warn(`[TimeService] Failed to sync with api ${api}:`, e);
    }
  }
}

// Start async synchronization immediately without blocking
syncTimeWithNetwork();

/**
 * Formats a Date object specifically to Asia/Ho_Chi_Minh timezone
 */
function formatWithIntl(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      ...options
    }).format(date);
  } catch (e) {
    // Fallback if timezone formatting is unsupported
    return date.toLocaleDateString("vi-VN");
  }
}

/**
 * Parse standard inputs into a valid Date object
 */
export function parseToDate(input?: Date | string | number): Date {
  if (!input) return getAccurateNow();
  if (input instanceof Date) return input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? getAccurateNow() : d;
}

export const TimeService = {
  /**
   * Parse standard inputs into a valid Date object
   */
  parseToDate(input?: Date | string | number): Date {
    return parseToDate(input);
  },

  /**
   * Returns current accurate date
   */
  now(): Date {
    return getAccurateNow();
  },

  /**
   * Returns current accurate timestamp in MS
   */
  nowTimestamp(): number {
    return getAccurateNow().getTime();
  },

  /**
   * Returns current date in "YYYY-MM-DD" format normalized to Asia/Ho_Chi_Minh
   */
  today(): string {
    return this.formatDateISO(getAccurateNow());
  },

  /**
   * Formats a date to "YYYY-MM-DD" in Asia/Ho_Chi_Minh timezone
   */
  formatDateISO(dateInput?: Date | string | number): string {
    const d = parseToDate(dateInput);
    const year = formatWithIntl(d, { year: "numeric" });
    const month = formatWithIntl(d, { month: "2-digit" });
    const day = formatWithIntl(d, { day: "2-digit" });
    return `${year}-${month}-${day}`;
  },

  /**
   * Formats a date to "DD/MM/YYYY" in Asia/Ho_Chi_Minh timezone
   */
  formatDate(dateInput?: Date | string | number): string {
    const d = parseToDate(dateInput);
    return formatWithIntl(d, { day: "2-digit", month: "2-digit", year: "numeric" });
  },

  /**
   * Formats a date to "HH:MM:SS DD/MM/YYYY" in Asia/Ho_Chi_Minh timezone
   */
  formatDateTime(dateInput?: Date | string | number): string {
    const d = parseToDate(dateInput);
    const dateStr = formatWithIntl(d, { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = formatWithIntl(d, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${timeStr} ${dateStr}`;
  },

  /**
   * Formats a date to "HH:MM:SS" in Asia/Ho_Chi_Minh timezone
   */
  formatTime(dateInput?: Date | string | number): string {
    const d = parseToDate(dateInput);
    return formatWithIntl(d, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  },

  /**
   * Returns a Date object representing the start of the current day (00:00:00.000)
   */
  startOfToday(): Date {
    const d = getAccurateNow();
    // Parse the components in Asia/Ho_Chi_Minh timezone and reconstruct to avoid local system shift
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(d);
    
    const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
    const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
    const day = parseInt(parts.find(p => p.type === "day")!.value, 10);

    // Build the date as local then shift to UTC+7 offset if needed
    const start = new Date(year, month, day, 0, 0, 0, 0);
    return start;
  },

  /**
   * Returns a Date object representing the end of the current day (23:59:59.999)
   */
  endOfToday(): Date {
    const start = this.startOfToday();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return end;
  },

  /**
   * Checks if a date is today in Asia/Ho_Chi_Minh timezone
   */
  isToday(dateInput: Date | string | number): boolean {
    const target = parseToDate(dateInput);
    const todayStr = this.formatDate(this.now());
    const targetStr = this.formatDate(target);
    return todayStr === targetStr;
  },

  /**
   * Checks if a date is yesterday in Asia/Ho_Chi_Minh timezone
   */
  isYesterday(dateInput: Date | string | number): boolean {
    const target = parseToDate(dateInput);
    const yesterday = new Date(this.now().getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = this.formatDate(yesterday);
    const targetStr = this.formatDate(target);
    return yesterdayStr === targetStr;
  },

  /**
   * Returns the exact difference in calendar days between two dates
   */
  daysBetween(d1: Date | string | number, d2: Date | string | number): number {
    const date1 = parseToDate(d1);
    const date2 = parseToDate(d2);

    // Normalize both dates to midnight of their respective timezones
    const d1Str = this.formatDate(date1);
    const d2Str = this.formatDate(date2);

    if (d1Str === d2Str) return 0;

    const [day1, month1, year1] = d1Str.split("/").map(Number);
    const [day2, month2, year2] = d2Str.split("/").map(Number);

    const utc1 = Date.UTC(year1, month1 - 1, day1);
    const utc2 = Date.UTC(year2, month2 - 1, day2);

    const diffMs = Math.abs(utc2 - utc1);
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  },

  /**
   * Returns the current hour in Asia/Ho_Chi_Minh timezone
   */
  getCurrentHour(): number {
    const d = getAccurateNow();
    return parseInt(formatWithIntl(d, { hour: "2-digit", hour12: false }), 10);
  },

  /**
   * Returns the current day of the month in Asia/Ho_Chi_Minh timezone
   */
  getCurrentDate(): number {
    const d = getAccurateNow();
    return parseInt(formatWithIntl(d, { day: "numeric" }), 10);
  },

  /**
   * Returns the current day of the week (0-6) where 0 is Sunday
   */
  getCurrentWeek(): number {
    const d = getAccurateNow();
    const shiftedDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return shiftedDate.getUTCDay();
  },

  /**
   * Returns current month (1-12) in Asia/Ho_Chi_Minh timezone
   */
  getCurrentMonth(): number {
    const d = getAccurateNow();
    return parseInt(formatWithIntl(d, { month: "numeric" }), 10);
  }
};
