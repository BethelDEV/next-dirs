import "server-only";
import { boundedBody } from "@/lib/bounded-body";
import { publicWebsiteUrl } from "@/lib/public-url";

export async function fetchPublicBytes(value: string, maximum: number) {
  let url = publicWebsiteUrl(value);
  const signal = AbortSignal.timeout(12000);
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Invalid redirect");
      url = publicWebsiteUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Website fetch failed");
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0];
    return { bytes: await boundedBody(response, maximum), type };
  }
  throw new Error("Too many redirects");
}
