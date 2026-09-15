import CollectionGrid from "@/components/collection/collection-grid";
import Container from "@/components/container";
import EmptyGrid from "@/components/shared/empty-grid";
import { HeaderSection } from "@/components/shared/header-section";
import CustomPagination from "@/components/shared/pagination";
import { siteConfig } from "@/config/site";
import { getCollections } from "@/data/collection";
import { COLLECTIONS_PER_PAGE } from "@/lib/constants";
import { constructMetadata } from "@/lib/metadata";

export const metadata = constructMetadata({
  title: "Collection",
  description: "Explore by collection",
  canonicalUrl: `${siteConfig.url}/collection`,
});

/**
 * https://www.uneed.best/alternatives
 * https://bestdirectories.org/collections
 */
export default async function CollectionIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { page } = ((await searchParams) ?? {}) as { [key: string]: string };
  const currentPage = page ? Number(page) : 1;
  const { collections, totalCount } = await getCollections({
    currentPage,
  });
  const totalPages = Math.ceil(totalCount / COLLECTIONS_PER_PAGE);
  console.log(
    "CollectionIndexPage, totalCount",
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
            title="Explore by collections"
          />
        </div>
      </div>

      <Container className="mt-8">
        <div>
          {/* when no items are found */}
          {collections?.length === 0 && <EmptyGrid />}

          {/* when items are found */}
          {collections && collections.length > 0 && (
            <section className="">
              <CollectionGrid collections={collections} />

              <div className="mt-8 flex items-center justify-center">
                <CustomPagination
                  routePrefix="/collection"
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
