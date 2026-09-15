import {
  QUERY_FILTER_LIST,
  SORT_FILTER_LIST,
  SUPPORT_CATEGORY_GROUP,
} from "@/lib/constants";
import type {
  CategoryListQueryResult,
  GroupListQueryResult,
  TagListQueryResult,
} from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  categoryListQuery,
  groupListQuery,
  tagListQuery,
} from "@/sanity/lib/queries";
import {
  type CategoryFilterItem,
  HomeSearchFilterClient,
  type TagFilterItem,
} from "./home-search-filter-client";

interface HomeSearchFilterProps {
  urlPrefix: string;
}

export async function HomeSearchFilter({ urlPrefix }: HomeSearchFilterProps) {
  let categories: CategoryFilterItem[] = [];
  let tags: TagFilterItem[] = [];

  if (SUPPORT_CATEGORY_GROUP) {
    const [groupList, tagList] = await Promise.all([
      sanityFetch<GroupListQueryResult>({
        query: groupListQuery,
      }),
      sanityFetch<TagListQueryResult>({
        query: tagListQuery,
      }),
    ]);

    // in mobile view, we need to show the group name before the category name
    categories = groupList.flatMap(
      (group) =>
        group.categories?.map((category) => ({
          slug: category.slug.current,
          name: `${group.name} / ${category.name}`,
        })) || [],
    );
    tags = tagList.map((tag) => ({
      slug: tag.slug.current,
      name: tag.name,
    }));
  } else {
    const [categoryList, tagList] = await Promise.all([
      sanityFetch<CategoryListQueryResult>({
        query: categoryListQuery,
      }),
      sanityFetch<TagListQueryResult>({
        query: tagListQuery,
      }),
    ]);

    categories = categoryList.map((category) => ({
      slug: category.slug.current,
      name: category.name,
    }));
    tags = tagList.map((tag) => ({
      slug: tag.slug.current,
      name: tag.name,
    }));
  }

  return (
    <div>
      {/* Desktop View, has Container */}
      <div className="hidden md:flex md:flex-col">
        <div className="w-full">
          <HomeSearchFilterClient
            tagList={tags}
            categoryList={categories}
            sortList={SORT_FILTER_LIST}
            filterList={QUERY_FILTER_LIST}
            urlPrefix={urlPrefix}
          />
        </div>
      </div>

      {/* Mobile View, no Container */}
      <div className="md:hidden flex flex-col">
        <div className="">
          <HomeSearchFilterClient
            tagList={tags}
            categoryList={categories}
            sortList={SORT_FILTER_LIST}
            filterList={QUERY_FILTER_LIST}
            urlPrefix={urlPrefix}
          />
        </div>
      </div>
    </div>
  );
}
