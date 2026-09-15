import "server-only";
export function previewToken() {
  const token = process.env.SANITY_PREVIEW_TOKEN;
  if (!token) throw new Error("CMS preview is not configured");
  return token;
}
