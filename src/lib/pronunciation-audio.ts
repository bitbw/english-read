/** 词典 CDN mp3 播放；全局单例避免多段同时播放 */

let lastAudio: HTMLAudioElement | null = null;

export function stopPronunciationAudio(): void {
  lastAudio?.pause();
  lastAudio = null;
}

/**
 * 播放发音 URL；失败时调用 onFailure（例如退回 TTS）。
 */
export function playPronunciationMp3(url: string, onFailure?: () => void): void {
  if (typeof window === "undefined" || !url) return;
  try {
    lastAudio?.pause();
    const a = new Audio(url);
    lastAudio = a;
    void a.play().catch(() => {
      onFailure?.();
    });
  } catch {
    onFailure?.();
  }
}
