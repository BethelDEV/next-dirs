/** Only explicit HTTP(S), anchors and local paths are allowed in rendered content. */
export function safeContentUrl(value: string, image = false): string {
  const url = value.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters before URL parsing.
  if (!url || /[\u0000-\u001f\u007f\\]/.test(url)) return "";
  if (!image && (url.startsWith("#") || /^\/(?!\/)/.test(url))) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (parsed.username || parsed.password) return "";
    // Embedded user images are public Sanity assets, not arbitrary tracking pixels.
    if (
      image &&
      (parsed.protocol !== "https:" || parsed.hostname !== "cdn.sanity.io")
    )
      return "";
    return parsed.href;
  } catch {
    return "";
  }
}
