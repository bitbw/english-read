/**
 * 艾宾浩斯遗忘曲线复习间隔算法（仿英语帮）
 *
 * review_stage: 0(新词) 1  2  3   4   5   ≥6(已掌握)
 * 间隔天数:       1      2  4  7   15  30
 */

const REVIEW_INTERVALS: Record<number, number> = {
  0: 1,
  1: 2,
  2: 4,
  3: 7,
  4: 15,
  5: 30,
};

export const MASTERED_STAGE = 6;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function calculateNextReview(
  currentStage: number,
  result: "remembered" | "forgotten"
): {
  nextStage: number;
  nextReviewAt: Date;
  isMastered: boolean;
} {
  if (result === "forgotten") {
    return {
      nextStage: 0,
      nextReviewAt: addDays(new Date(), REVIEW_INTERVALS[0]),
      isMastered: false,
    };
  }

  const nextStage = currentStage + 1;

  if (nextStage >= MASTERED_STAGE) {
    return {
      nextStage: MASTERED_STAGE,
      nextReviewAt: addDays(new Date(), 365),
      isMastered: true,
    };
  }

  return {
    nextStage,
    nextReviewAt: addDays(new Date(), REVIEW_INTERVALS[nextStage]),
    isMastered: false,
  };
}

/** 新词默认的首次复习时间 */
export function getInitialReviewDate(): Date {
  return addDays(new Date(), REVIEW_INTERVALS[0]);
}

/** 获取阶段对应的标签文字 */
export function getStageName(stage: number): string {
  if (stage === 0) return "新词";
  if (stage >= MASTERED_STAGE) return "已掌握";
  return `第${stage}次复习`;
}

/** 获取阶段对应的颜色 class（Tailwind） */
export function getStageColor(stage: number): string {
  const colors: Record<number, string> = {
    0: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    1: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    3: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300",
    4: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    5: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };
  if (stage >= MASTERED_STAGE) {
    return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  }
  return colors[stage] ?? colors[0];
}
