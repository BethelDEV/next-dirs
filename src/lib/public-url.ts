/** workerd also enforces global_fetch_strictly_public against private DNS answers. */
export function publicWebsiteUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
    /(?:^|\.)(localhost|local|internal|invalid|test)$/i.test(url.hostname)
  )
    throw new Error("Use a public HTTPS website");
  return url;
}
