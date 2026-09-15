"use client";

import type { SubmissionDto as ItemInfo } from "@/db/listings";
import { urlForImage } from "@/lib/image";
import { HashIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type SubmissionCardImageProps = {
  item: ItemInfo;
};

export default function SubmissionCardImage({
  item,
}: SubmissionCardImageProps) {
  // console.log('SubmissionCard, item:', item);
  const imageProps = item?.image ? urlForImage(item.image) : null;
  const imageBlurDataURL = item?.image?.blurDataURL || null;
  // console.log(`SubmissionCard, imageBlurDataURL:${imageBlurDataURL}`);

  return (
    <div className="relative group overflow-hidden rounded-lg aspect-[16/9]">
      {imageProps && (
        <div className="relative w-full h-full">
          <Image
            src={imageProps.src}
            alt={item.image?.alt || `image for ${item.name}`}
            loading="eager"
            fill
            className="border w-full shadow-lg image-scale"
            {...(imageBlurDataURL && {
              placeholder: "blur",
              blurDataURL: imageBlurDataURL,
            })}
          />

          <div className="absolute left-2 bottom-2 opacity-100 transition-opacity duration-300">
            <div className="flex flex-col gap-2">
              {item.categories && item.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.categories.map((category) => (
                    <span
                      key={category._id}
                      className="text-xs font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded-md"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  {item.tags
                    .filter((tag) => tag.slug.current)
                    .slice(0, 5)
                    .map((tag) => (
                      <Link
                        key={tag._id}
                        href={`/tag/${tag.slug.current}`}
                        className="flex items-center justify-center space-x-0.5 group"
                      >
                        <HashIcon className="w-3 h-3 text-muted-foreground icon-scale" />
                        <span className="text-sm text-muted-foreground link-underline">
                          {tag.name}
                        </span>
                      </Link>
                    ))}
                  {item.tags.length > 5 && (
                    <span className="text-sm text-muted-foreground px-1">
                      +{item.tags.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {item.publishDate ? (
        <Link
          href={`/item/${item.slug.current}`}
          className="absolute inset-0 flex items-center justify-center bg-black 
                    bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-300"
        >
          <span
            className="text-white text-lg font-semibold 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            View on site
          </span>
        </Link>
      ) : null}
    </div>
  );
}
