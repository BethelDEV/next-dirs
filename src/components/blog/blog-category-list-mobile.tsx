"use client";

import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { BlogCategoryListQueryResult } from "@/sanity.types";
import { LayoutListIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import FilterItemMobile from "../shared/filter-item-mobile";

export type BlogCategoryListMobileProps = {
  categoryList: BlogCategoryListQueryResult;
};

export function BlogCategoryListMobile({
  categoryList,
}: BlogCategoryListMobileProps) {
  const [open, setOpen] = useState(false);
  const { slug } = useParams() as { slug?: string };
  const selectedCategory = categoryList.find(
    (category) => category.slug.current === slug,
  );

  const closeDrawer = () => {
    setOpen(false);
  };

  return (
    <Drawer open={open} onClose={closeDrawer}>
      <DrawerTrigger
        onClick={() => setOpen(true)}
        className="flex items-center w-full p-3 border-y text-foreground/90"
      >
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2">
            <LayoutListIcon className="size-5" />
            <span className="text-sm">Category</span>
          </div>
          <span className="text-sm">
            {selectedCategory?.name ? `${selectedCategory?.name}` : "All"}
          </span>
        </div>
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-40 bg-background/50" />
        <DrawerContent className="fixed inset-x-0 bottom-0 z-50 mt-24 overflow-hidden rounded-t-[10px] border bg-background">
          <DrawerTitle className="sr-only">Category</DrawerTitle>

          <ul className="mb-14 w-full p-3 text-muted-foreground">
            <FilterItemMobile
              title="All"
              href="/blog"
              active={!slug}
              clickAction={closeDrawer}
            />

            {categoryList.map((item) => (
              <FilterItemMobile
                key={item.slug.current}
                title={item.name}
                href={`/blog/category/${item.slug.current}`}
                active={item.slug.current === slug}
                clickAction={closeDrawer}
              />
            ))}
          </ul>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
