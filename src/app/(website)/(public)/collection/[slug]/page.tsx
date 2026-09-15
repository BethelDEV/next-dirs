import Container from "@/components/container";
import ItemGrid from "@/components/item/item-grid";
import EmptyGrid from "@/components/shared/empty-grid";
import { HeaderSection } from "@/components/shared/header-section";
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
  CollectionQueryResult,
  SponsorItemListQueryResult,
} from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { collectionQuery, sponsorItemListQuery } from "@/sanity/lib/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const collection = await sanityFetch<CollectionQueryResult>({
    query: collectionQuery,
    params: { slug: (await params).slug },
  });
  if (!collection) {
    console.warn(
      `generateMetadata, collection not found for slug: ${(await params).slug}`,
    );
    return;
  }

  const ogImageUrl = new URL(`${siteConfig.url}/api/og`);
  ogImageUrl.searchParams.append("title", collection.name);
  ogImageUrl.searchParams.append("description", collection.description || "");
  ogImageUrl.searchParams.append("type", "Collection");

  return constructMetadata({
    title: `${collection.name}`,
    description: collection.description,
    canonicalUrl: `${siteConfig.url}/collection/${(await params).slug}`,
    // image: ogImageUrl.toString(),
  });
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const collection = await sanityFetch<CollectionQueryResult>({
    query: collectionQuery,
    params: { slug: (await params).slug },
  });
  if (!collection) {
    console.warn(
      `CollectionPage, collection not found for slug: ${(await params).slug}`,
    );
    return notFound();
  }

  const sponsorItems =
    (await sanityFetch<SponsorItemListQueryResult>({
      query: sponsorItemListQuery,
    })) || [];
  // console.log("CollectionPage, sponsorItems", sponsorItems);
  const showSponsor = true;
  const hasSponsorItem = showSponsor && sponsorItems.length > 0;

  const { sort, page } = ((await searchParams) ?? {}) as {
    [key: string]: string;
  };
  const { sortKey, reverse } =
    SORT_FILTER_LIST.find((item) => item.slug === sort) || DEFAULT_SORT;
  const currentPage = page ? Number(page) : 1;
  const { items, totalCount } = await getItems({
    collection: (await params).slug,
    sortKey,
    reverse,
    currentPage,
    hasSponsorItem,
  });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  console.log(
    "CollectionPage, totalCount",
    totalCount,
    ", totalPages",
    totalPages,
  );

  return (
    <div className="mb-16">
      <div className="mt-8">
        <div className="w-full flex flex-col items-center justify-center gap-8">
          <HeaderSection
            labelAs="h1"
            label="Collection"
            titleAs="h2"
            title={`${collection?.name}`}
          />
        </div>
      </div>

      <Container className="mt-8">
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
                  routePrefix={`/collection/${(await params).slug}`}
                  totalPages={totalPages}
                />
              </div>
            </section>
          )}
        </div>
      </Container>
    </div>
  );
}
