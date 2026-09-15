import { SUPPORT_CATEGORY_GROUP } from "@/lib/constants";
import type {
  CategoryListQueryResult,
  GroupListQueryResult,
} from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { categoryListQuery, groupListQuery } from "@/sanity/lib/queries";
import { HomeCategoryListClient } from "./home-category-list-client";
import { HomeGroupListClient } from "./home-group-list-client";

export async function HomeCategoryList({
  urlPrefix,
}: {
  urlPrefix: string;
}) {
  if (SUPPORT_CATEGORY_GROUP) {
    const groupList = await sanityFetch<GroupListQueryResult>({
      query: groupListQuery,
    });

    return <HomeGroupListClient groupList={groupList} urlPrefix={urlPrefix} />;
  }

  const categoryList = await sanityFetch<CategoryListQueryResult>({
    query: categoryListQuery,
  });

  return (
    <HomeCategoryListClient categoryList={categoryList} urlPrefix={urlPrefix} />
  );
}
