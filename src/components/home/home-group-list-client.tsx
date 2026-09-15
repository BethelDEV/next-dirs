"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { GroupListQueryResult } from "@/sanity.types";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_FILTER_VALUE } from "../shared/combobox";

export type HomeGroupListClientProps = {
  groupList: GroupListQueryResult;
  urlPrefix: string;
};

export function HomeGroupListClient({
  groupList,
  urlPrefix,
}: HomeGroupListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get("category") || DEFAULT_FILTER_VALUE;
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedCategory || selectedCategory === DEFAULT_FILTER_VALUE) {
      setOpenCategories(new Set());
      return;
    }

    const parentCategory = groupList.find((group) =>
      group.categories.some(
        (category) => category.slug?.current === selectedCategory,
      ),
    );

    if (parentCategory) {
      setOpenCategories(new Set([parentCategory.slug.current]));
    }
  }, [selectedCategory, groupList]);

  const categoryFilterItemList = [
    { value: DEFAULT_FILTER_VALUE, label: "All Categories", subCategories: [] },
    ...groupList.map((item) => ({
      value: item.slug.current,
      label: item.name,
      subCategories:
        item.categories.map((category) => ({
          _id: category._id,
          title: category.name || "",
          slug: category.slug?.current || "",
        })) || [],
    })),
  ];

  const handleFilterChange = (
    type: string,
    value: string,
    isSubCategory = false,
  ) => {
    if (!isSubCategory && value !== DEFAULT_FILTER_VALUE) {
      return;
    }

    const newParams = new URLSearchParams(window.location.search);
    if (value === null || value === DEFAULT_FILTER_VALUE) {
      newParams.delete(type);
    } else {
      newParams.set(type, value);
    }
    newParams.delete("page");
    router.push(`${urlPrefix}?${newParams.toString()}`);
  };

  const toggleCategory = (categoryValue: string) => {
    const newOpenCategories = new Set<string>();
    if (!openCategories.has(categoryValue)) {
      newOpenCategories.add(categoryValue);
    }
    setOpenCategories(newOpenCategories);
  };

  return (
    <div className="hidden md:flex border rounded-lg p-4">
      <ul className="flex flex-col gap-y-2 w-full">
        {categoryFilterItemList.map((item) => {
          const isOpen = openCategories.has(item.value);
          const isAllCategories = item.value === DEFAULT_FILTER_VALUE;

          return (
            <Collapsible
              key={item.value}
              open={isOpen}
              onOpenChange={() => toggleCategory(item.value)}
              className="w-full space-y-2"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant={
                    isAllCategories && item.value === selectedCategory
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  className="w-full px-3 py-3 justify-between"
                  onClick={(e) => {
                    if (isAllCategories) {
                      handleFilterChange("category", item.value);
                    }
                    toggleCategory(item.value);
                  }}
                >
                  <span>{item.label}</span>
                  {item.subCategories.length > 0 && (
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isOpen ? "transform rotate-180" : ""
                      }`}
                    />
                  )}
                </Button>
              </CollapsibleTrigger>
              {item.subCategories.length > 0 && (
                <CollapsibleContent className="space-y-2">
                  {item.subCategories.map((subCategory) => (
                    <Button
                      key={subCategory._id}
                      variant={
                        subCategory.slug === selectedCategory
                          ? "default"
                          : "ghost"
                      }
                      size="sm"
                      className="w-full px-6 py-2 justify-start"
                      onClick={() =>
                        handleFilterChange("category", subCategory.slug, true)
                      }
                    >
                      {subCategory.title}
                    </Button>
                  ))}
                </CollapsibleContent>
              )}
            </Collapsible>
          );
        })}
      </ul>
    </div>
  );
}
