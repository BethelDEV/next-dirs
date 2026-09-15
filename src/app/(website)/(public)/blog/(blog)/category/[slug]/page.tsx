import BlogGrid from "@/components/blog/blog-grid";
import EmptyGrid from "@/components/shared/empty-grid";
import CustomPagination from "@/components/shared/pagination";
import { siteConfig } from "@/config/site";
import { getBlogs } from "@/data/blog";
import { POSTS_PER_PAGE } from "@/lib/constants";
import { constructMetadata } from "@/lib/metadata";
import type { BlogCategoryMetadateQueryResult } from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { blogCategoryMetadateQuery } from "@/sanity/lib/queries";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const category = await sanityFetch<BlogCategoryMetadateQueryResult>({
    query: blogCategoryMetadateQuery,
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
  ogImageUrl.searchParams.append("type", "Blog Category");

  return constructMetadata({
    title: `${category.name}`,
    description: category.description,
    canonicalUrl: `${siteConfig.url}/blog/category/${(await params).slug}`,
    // image: ogImageUrl.toString(),
  });
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // console.log('BlogCategoryPage, searchParams', searchParams);
  const { page } = ((await searchParams) ?? {}) as { [key: string]: string };
  const currentPage = page ? Number(page) : 1;
  const { posts, totalCount } = await getBlogs({
    category: (await params).slug,
    currentPage,
  });
  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);
  console.log(
    "BlogCategoryPage, totalCount",
    totalCount,
    ", totalPages",
    totalPages,
  );

  return (
    <div>
      {/* when no posts are found */}
      {posts?.length === 0 && <EmptyGrid />}

      {/* when posts are found */}
      {posts && posts?.length > 0 && (
        <div>
          <BlogGrid posts={posts} />

          <div className="mt-8 flex items-center justify-center">
            <CustomPagination
              routePrefix={`/blog/${(await params).slug}`}
              totalPages={totalPages}
            />
          </div>
        </div>
      )}
    </div>
  );
}
