/**
 * 单词复习状态：
 * - 忘记/生词：阶段 0～5，基础间隔 1、2、4、7、15、30 天
 * - 记住/加练：阶段 6～8，加练间隔 60、120、240 天
 * - 掌握：isMastered=true，不再进入复习队列
 */

import { addDays, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

const BASIC_INTERVALS = [1, 2, 4, 7, 15, 30] as const;
const EXTRA_INTERVALS = [60, 120, 240] as const;

export const EXTRA_START_STAGE = BASIC_INTERVALS.length;
export const EXTRA_END_STAGE = EXTRA_START_STAGE + EXTRA_INTERVALS.length - 1;
export const MASTERED_STAGE = EXTRA_END_STAGE;

export type ReviewAction = "advance" | "remembered" | "forgotten" | "mastered";
export type VocabularyState = "forgotten" | "remembered" | "mastered";

/** 在该 IANA 时区下：从「今天 0 点」起算，经过 `calendarDays` 个日历日后的当天 0 点（UTC 瞬时） */
function addCalendarDaysFromTodayAtMidnight(calendarDays: number, timeZone: string): Date {
  const todayStart = startOfDay(new TZDate(Date.now(), timeZone));
  const target = addDays(todayStart, calendarDays, { in: tz(timeZone) });
  return new Date(target.getTime());
}

export function calculateNextReview(
  currentStage: number,
  result: "remembered" | "forgotten",
  timeZone: string
): {
  nextStage: number;
  nextReviewAt: Date;
  isMastered: boolean;
} {
  return calculateReviewTransition(
    currentStage,
    false,
    result === "forgotten" ? "forgotten" : "advance",
    timeZone,
  );
}

function intervalForStage(stage: number): number {
  if (stage < EXTRA_START_STAGE) {
    return BASIC_INTERVALS[Math.max(0, stage)] ?? BASIC_INTERVALS[0];
  }
  return EXTRA_INTERVALS[Math.min(stage - EXTRA_START_STAGE, EXTRA_INTERVALS.length - 1)]!;
}

export function getVocabularyState(reviewStage: number, isMastered: boolean): VocabularyState {
  if (isMastered) return "mastered";
  return reviewStage >= EXTRA_START_STAGE ? "remembered" : "forgotten";
}

export function calculateReviewTransition(
  currentStage: number,
  isMastered: boolean,
  action: ReviewAction,
  timeZone: string,
): {
  nextStage: number;
  nextReviewAt: Date;
  isMastered: boolean;
} {
  if (action === "forgotten") {
    return {
      nextStage: 0,
      nextReviewAt: addCalendarDaysFromTodayAtMidnight(BASIC_INTERVALS[0], timeZone),
      isMastered: false,
    };
  }

  if (action === "mastered") {
    if (isMastered || currentStage < EXTRA_START_STAGE) {
      throw new Error("Only remembered words can be mastered");
    }
    return {
      nextStage: currentStage,
      nextReviewAt: addCalendarDaysFromTodayAtMidnight(EXTRA_INTERVALS[EXTRA_INTERVALS.length - 1], timeZone),
      isMastered: true,
    };
  }

  if (action === "remembered") {
    return {
      nextStage: EXTRA_START_STAGE,
      nextReviewAt: addCalendarDaysFromTodayAtMidnight(EXTRA_INTERVALS[0], timeZone),
      isMastered: false,
    };
  }

  if (isMastered) {
    throw new Error("Mastered words must be reset before reviewing");
  }

  const nextStage = currentStage < EXTRA_END_STAGE ? currentStage + 1 : EXTRA_END_STAGE;

  return {
    nextStage,
    nextReviewAt: addCalendarDaysFromTodayAtMidnight(intervalForStage(nextStage), timeZone),
    isMastered: false,
  };
}

/** 新词默认的首次复习时间（学习时区下「明天 0 点」起算语义，与间隔表一致） */
export function getInitialReviewDate(timeZone: string): Date {
  return addCalendarDaysFromTodayAtMidnight(BASIC_INTERVALS[0], timeZone);
}

/** 获取阶段对应的标签文字 */
export function getStageName(stage: number, isMastered = false): string {
  if (isMastered) return "掌握";
  if (stage < EXTRA_START_STAGE) return stage === 0 ? "新词" : `基础第${stage}次`;
  return `加练第${stage - EXTRA_START_STAGE + 1}次`;
}

/** 获取阶段对应的颜色 class（Tailwind） */
export function getStageColor(stage: number, isMastered = false): string {
  if (isMastered) {
    return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  }
  const colors: Record<number, string> = {
    0: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    1: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    3: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300",
    4: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    5: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    6: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    7: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    8: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-300",
  };
  return colors[stage] ?? colors[0];
}
