"use client";
import dynamic from "next/dynamic";
// Studio is an authenticated browser application; avoid bundling its editor
// implementation into the Worker that serves the public directory.
const StudioClient = dynamic(
  () => import("@/components/studio/studio-client"),
  { ssr: false, loading: () => <p>Loading Studio…</p> },
);
export default function Studio() {
  return <StudioClient />;
}
