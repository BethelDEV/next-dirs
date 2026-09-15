"use client";

import { urlForIcon } from "@/lib/image";
import { cn, getItemTargetLinkInWebsite } from "@/lib/utils";
import type { ItemInfo } from "@/types";
import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";

type SponsorItemCardProps = {
  item: ItemInfo;
};

/**
 * SponsorItemCard shows item icon
 */
export default function SponsorItemCard({ item }: SponsorItemCardProps) {
  const iconProps = item?.icon ? urlForIcon(item.icon) : null;
  const iconBlurDataURL = item?.icon?.blurDataURL || null;
  // console.log(`SponsorItemCard, iconBlurDataURL:${iconBlurDataURL}`);
  const itemLink = getItemTargetLinkInWebsite(item);

  return (
    <Link
      href={itemLink}
      target="_blank"
      className={cn(
        "border rounded-lg flex flex-col justify-between p-6",
        "duration-300 shadow-sm hover:shadow-md transition-shadow",
        "border-sky-300 border-spacing-1.5 bg-sky-50/50 dark:bg-sky-950/10 hover:bg-sky-50 dark:hover:bg-accent/60",
      )}
    >
      {/* top */}
      <div className="flex flex-col gap-4">
        {/* icon + name */}
        <div className="flex w-full items-center gap-4">
          {iconProps && (
            <Image
              src={iconProps?.src}
              alt={item.icon.alt || `icon of ${item.name}`}
              title={item.icon.alt || `icon of ${item.name}`}
              width={32}
              height={32}
              className="object-cover image-scale rounded-md"
              // {...(iconBlurDataURL && {
              //   placeholder: "blur",
              //   blurDataURL: iconBlurDataURL,
              // })}
            />
          )}

          <div className="flex-1 flex justify-between items-center gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "text-xl font-medium truncate",
                  item.featured && "text-gradient_indigo-purple font-semibold",
                )}
              >
                {item.name}
              </h3>
            </div>

            <span className="text-sm text-sky-500 border border-sky-500 rounded-md px-2 py-0.5 shrink-0">
              AD
            </span>
          </div>
        </div>

        {/* description */}
        <p className="text-sm line-clamp-3 leading-relaxed min-h-[4.5rem]">
          {item.description}
        </p>
      </div>

      {/* bottom */}
      <div className="mt-4 w-full flex justify-center items-center">
        {/* action button */}
        <Button
          size="lg"
          variant="outline"
          className={cn(
            "overflow-hidden rounded-full w-full bg-sky-500 hover:bg-sky-600",
            "group transition-transform duration-300 ease-in-out hover:scale-105",
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-white font-semibold">Visit Website</span>
            <ArrowUpRightIcon className="text-white font-semibold size-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Button>
      </div>
    </Link>
  );
}
