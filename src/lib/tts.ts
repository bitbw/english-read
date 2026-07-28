/**
 * 统一 TTS：Capacitor 原生 → 浏览器 speechSynthesis 回退。
 * 使用 Capacitor registerPlugin 直接注册插件接口（避免动态 import 的打包问题），
 * 在 Android App 内调用原生 TextToSpeech 引擎，
 * 在浏览器中回退到 window.speechSynthesis。
 */

import { registerPlugin } from "@capacitor/core";

const isBrowser = typeof window !== "undefined";

interface TextToSpeechPlugin {
  speak(options: {
    text: string;
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    category?: string;
    queueStrategy?: number;
  }): Promise<void>;
  stop(): Promise<void>;
}

const NativeTts = registerPlugin<TextToSpeechPlugin>("TextToSpeech");

/** 朗读指定文本（自动选择 Capacitor 原生 TTS 或浏览器 speechSynthesis） */
export async function speakText(text: string, lang = "en-US"): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || !isBrowser) return;

  // 优先 Capacitor 原生 TTS
  try {
    await NativeTts.speak({
      text: trimmed,
      lang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: "ambient",
      queueStrategy: 1,
    });
    return;
  } catch (e) {
    console.warn(
      `[BOWEN_LOG] Capacitor TTS unavailable, fallback to browser speechSynthesis:`,
      e,
    );
  }

  // 浏览器 speechSynthesis 回退
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("[BOWEN_LOG] speechSynthesis not available in this browser");
  }
}

/** 停止当前朗读 */
export async function stopSpeaking(): Promise<void> {
  if (!isBrowser) return;

  try {
    await NativeTts.stop();
    return;
  } catch (e) {
    console.warn("[BOWEN_LOG] Capacitor TTS stop unavailable:", e);
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}