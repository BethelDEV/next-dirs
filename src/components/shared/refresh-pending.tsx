"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
/** Poll while asynchronous payment/publication is settling; stop after 2 minutes. */
export function RefreshPending({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
      if (++count >= 24) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
