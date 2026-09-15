import ItemGrid from "@/components/item/item-grid";
import EmptyGrid from "@/components/shared/empty-grid";
import CustomPagination from "@/components/shared/pagination";
import { siteConfig } from "@/config/site";
import { getItems } from "@/data/item";
import {
  DEFAULT_SORT,
  ITEMS_PER_PAGE,
  SORT_FILTER_LIST,
} from "@/lib/constants";
import { constructMetadata } from "@/lib/metadata";
import type {
  CategoryQueryResult,
  SponsorItemListQueryResult,
} from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { categoryQuery, sponsorItemListQuery } from "@/sanity/lib/queries";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const category = await sanityFetch<CategoryQueryResult>({
    query: categoryQuery,
    params: { slug: (await params).slug },
  });
  if (!category) {
    console.warn(
      `generateMetadata, category not found for slug: ${(await params).slug}`,
    );
    return;
  }

  const ogImageUrl = new URL(`${siteConfig.url}/api/og`);
  ogImageUrl.searchParams.append("title", category.name);
  ogImageUrl.searchParams.append("description", category.description || "");
  ogImageUrl.searchParams.append("type", "Category");

  return constructMetadata({
    title: `${category.name}`,
    description: category.description,
    canonicalUrl: `${siteConfig.url}/category/${(await params).slug}`,
    // image: ogImageUrl.toString(),
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sponsorItems =
    (await sanityFetch<SponsorItemListQueryResult>({
      query: sponsorItemListQuery,
    })) || [];
  // console.log("CategoryPage, sponsorItems", sponsorItems);
  const showSponsor = true;
  const hasSponsorItem = showSponsor && sponsorItems.length > 0;

  const { sort, page } = ((await searchParams) ?? {}) as {
    [key: string]: string;
  };
  const { sortKey, reverse } =
    SORT_FILTER_LIST.find((item) => item.slug === sort) || DEFAULT_SORT;
  const currentPage = page ? Number(page) : 1;
  const { items, totalCount } = await getItems({
    category: (await params).slug,
    sortKey,
    reverse,
    currentPage,
    hasSponsorItem,
  });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  console.log(
    "CategoryPage, totalCount",
    totalCount,
    ", totalPages",
    totalPages,
  );

  return (
    <div>
      {/* when no items are found */}
      {items?.length === 0 && <EmptyGrid />}

      {/* when items are found */}
      {items && items.length > 0 && (
        <section className="">
          <ItemGrid
            items={items}
            sponsorItems={sponsorItems}
            showSponsor={showSponsor}
          />

          <div className="mt-8 flex items-center justify-center">
            <CustomPagination
              routePrefix={`/category/${(await params).slug}`}
              totalPages={totalPages}
            />
          </div>
        </section>
      )}
    </div>
  );
}
