import { CmsContent } from "@/components/shared/cms-content";
import { siteConfig } from "@/config/site";
import { constructMetadata } from "@/lib/metadata";
import type { PageQueryResult } from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { pageQuery } from "@/sanity/lib/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const page = await sanityFetch<PageQueryResult>({
    query: pageQuery,
    params: { slug: (await params).slug },
  });
  if (!page) {
    console.warn(
      `generateMetadata, page not found for slug: ${(await params).slug}`,
    );
    return;
  }

  return constructMetadata({
    title: page.title,
    description: page.excerpt,
    canonicalUrl: `${siteConfig.url}/${(await params).slug}`,
  });
}

interface CustomPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomPage({ params }: CustomPageProps) {
  console.log(`CustomPage, params: ${JSON.stringify(params)}`);
  const page = await sanityFetch<PageQueryResult>({
    query: pageQuery,
    params: { slug: (await params).slug },
  });

  if (!page) {
    return notFound();
  }

  console.log(`CustomPage, page title: ${page.title}`);
  // console.log('CustomPage, page body: ', page.body);
  // console.log("markdownContent", markdownContent);

  return (
    <div>
      <div className="flex flex-col items-center justify-center">
        <h1 className="inline-block text-2xl font-bold">{page.title}</h1>
        {page.excerpt && (
          <p className="mt-4 text-lg text-muted-foreground">{page.excerpt}</p>
        )}
      </div>
      <hr className="my-4" />
      <article className="">
        {page.body && <CmsContent value={page.body} />}
      </article>
    </div>
  );
}
