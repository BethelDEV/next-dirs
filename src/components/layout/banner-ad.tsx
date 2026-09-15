"use client";

import { getBannerAd } from "@/actions/get-banner-ad";
import { useEffect, useState } from "react";

interface AdData {
  content: string;
  url: string;
}

/**
 * Banner Ad
 *
 * Note:
 * 1. we only show the first sponsor item as banner ad
 * 2. the banner ad is sticky at the top of the page
 */
export function BannerAd() {
  const [adData, setAdData] = useState<AdData | null>(null);

  useEffect(() => {
    const fetchBannerAd = async () => {
      try {
        const result = await getBannerAd();
        if (result.status === "success") {
          setAdData(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch ad data:", error);
      }
    };

    fetchBannerAd();
  }, []);

  if (!adData) return null;

  return (
    <div className="bg-gradient-to-r from-purple-400 via-purple-600 to-purple-400 text-white py-2">
      <div className="container mx-auto px-4">
        <a
          href={adData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center hover:underline"
        >
          {adData.content}
        </a>
      </div>
    </div>
  );
}
