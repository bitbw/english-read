/** 浏览器端：上传封面到 Blob，返回公开 URL */
export async function postCoverUpload(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload/cover", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? "封面上传失败");
  }
  return res.json() as Promise<{ url: string }>;
}
