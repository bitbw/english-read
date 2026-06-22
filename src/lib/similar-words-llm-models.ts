/** Vercel AI Gateway Free Tier 文本模型（价格来自 Gateway Model List，2026-03） */

export const DEFAULT_PHRASE_LLM_MODEL = "google/gemma-4-26b-a4b-it";

/** 单次短语干扰项请求的典型 token 量（用于估算性价比排序） */
const TYPICAL_INPUT_TOKENS = 320;
const TYPICAL_OUTPUT_TOKENS = 160;

export type PhraseLlmModelOption = {
  id: string;
  inputPerM: number;
  outputPerM: number;
  /** 参考延迟（秒），Gateway 列表 */
  latencySec?: number;
  /** 按典型 token 估算的单次请求成本（USD） */
  estimatedCostUsd: number;
};

type PhraseLlmModelRaw = Omit<PhraseLlmModelOption, "estimatedCostUsd">;

function estimateRequestCostUsd(inputPerM: number, outputPerM: number): number {
  return (inputPerM * TYPICAL_INPUT_TOKENS + outputPerM * TYPICAL_OUTPUT_TOKENS) / 1_000_000;
}

const FREE_TIER_MODELS_RAW: PhraseLlmModelRaw[] = [
  { id: "google/gemma-4-26b-a4b-it", inputPerM: 0.13, outputPerM: 0.4, latencySec: 0.5 },
  { id: "google/gemma-4-31b-it", inputPerM: 0.14, outputPerM: 0.4, latencySec: 0.9 },
  { id: "xiaomi/mimo-v2.5", inputPerM: 0.14, outputPerM: 0.28 },
  { id: "stepfun/step-3.7-flash", inputPerM: 0.2, outputPerM: 1.15, latencySec: 0.8 },
  { id: "arcee-ai/trinity-large-thinking", inputPerM: 0.25, outputPerM: 0.9, latencySec: 0.3 },
  { id: "minimax/minimax-m3", inputPerM: 0.3, outputPerM: 1.2, latencySec: 1.0 },
  { id: "nvidia/nemotron-3-ultra", inputPerM: 0.37, outputPerM: 1.08, latencySec: 2.6 },
  { id: "xiaomi/mimo-v2.5-pro", inputPerM: 0.43, outputPerM: 0.87, latencySec: 1.1 },
  { id: "alibaba/qwen3.6-plus", inputPerM: 0.5, outputPerM: 3.0, latencySec: 1.0 },
  { id: "alibaba/qwen3.6-27b", inputPerM: 0.6, outputPerM: 3.6, latencySec: 0.9 },
  { id: "moonshotai/kimi-k2.7-code", inputPerM: 0.74, outputPerM: 3.5, latencySec: 0.3 },
  { id: "xai/grok-build-0.1", inputPerM: 1.0, outputPerM: 2.0, latencySec: 1.0 },
  { id: "zai/glm-5.2", inputPerM: 1.4, outputPerM: 4.4, latencySec: 0.3 },
];

/** 按估算单次请求成本升序（性价比从高到低） */
export const PHRASE_LLM_MODEL_OPTIONS: PhraseLlmModelOption[] = FREE_TIER_MODELS_RAW.map(
  (m) => ({
    ...m,
    estimatedCostUsd: estimateRequestCostUsd(m.inputPerM, m.outputPerM),
  })
).sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);

const ALLOWED_IDS = new Set(PHRASE_LLM_MODEL_OPTIONS.map((m) => m.id));

export function isAllowedPhraseLlmModel(model: string): boolean {
  return ALLOWED_IDS.has(model.trim());
}

export function resolvePhraseLlmModel(modelParam?: string | null): string {
  const trimmed = modelParam?.trim();
  if (trimmed && isAllowedPhraseLlmModel(trimmed)) {
    return trimmed;
  }
  return DEFAULT_PHRASE_LLM_MODEL;
}

export function formatPhraseLlmModelOptionLabel(model: PhraseLlmModelOption, rank: number): string {
  const latency =
    model.latencySec != null ? ` · ~${model.latencySec}s` : "";
  return `#${rank} ${model.id} — In $${model.inputPerM}/M · Out $${model.outputPerM}/M · ~$${model.estimatedCostUsd.toFixed(5)}/req${latency}`;
}
