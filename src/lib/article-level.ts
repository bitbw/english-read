const API_PATH = "/api/user/preferences";

export async function fetchArticleLevel(): Promise<number> {
  try {
    const res = await fetch(API_PATH);
    if (!res.ok) return 1;
    const data = await res.json();
    return data.articleLevel ?? 1;
  } catch {
    return 1;
  }
}

export async function saveArticleLevel(level: number): Promise<boolean> {
  try {
    const res = await fetch(API_PATH, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleLevel: level }),
    });
    return res.ok;
  } catch {
    return false;
  }
}