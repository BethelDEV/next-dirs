import { ITEMS_PER_PAGE } from "@/lib/constants";
import type { ItemListQueryResult } from "@/sanity.types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { itemSimpleFields } from "@/sanity/lib/queries";
import type { ItemInfo } from "@/types";
export async function getItemById(id: string) {
  return sanityFetch<ItemInfo>({
    query: `*[_type=="item" && visible==true && _id==$id][0]{${itemSimpleFields}}`,
    params: { id },
  });
}
export const getItemInfoById = getItemById;
export async function getItems({
  collection,
  category,
  tag,
  sortKey,
  reverse,
  query,
  filter,
  currentPage,
  hasSponsorItem,
}: {
  collection?: string;
  category?: string;
  tag?: string;
  sortKey?: string;
  reverse?: boolean;
  query?: string;
  filter?: string;
  currentPage: number;
  hasSponsorItem?: boolean;
}) {
  const page =
    Number.isSafeInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  const size = hasSponsorItem ? ITEMS_PER_PAGE - 1 : ITEMS_PER_PAGE;
  const key = sortKey === "name" ? "name" : "publishDate";
  const direction = reverse === false ? "asc" : "desc";
  const tags =
    typeof tag === "string" ? tag.split(",").filter(Boolean).slice(0, 20) : [];
  const params = {
    collection: collection ?? "",
    category: category ?? "",
    tags,
    searchTerm: query ? `*${query.slice(0, 200)}*` : "",
    featured: filter === "featured==true",
    start: (page - 1) * size,
    end: page * size,
  };
  const condition = `_type=="item" && visible==true && defined(slug.current) && defined(publishDate)
    && !(sponsor==true && sponsorStartDate<=now() && sponsorEndDate>now())
    && ($collection=='' || _id in *[_type=="collection" && slug.current==$collection].items[]._ref)
    && ($category=='' || references(*[_type=="category" && slug.current==$category]._id))
    && count((tags[]->slug.current)[@ in $tags])==count($tags)
    && ($searchTerm=='' || name match $searchTerm || description match $searchTerm || introduction match $searchTerm)
    && (!$featured || featured==true)`;
  const [totalCount, items] = await Promise.all([
    sanityFetch<number>({ query: `count(*[${condition}])`, params }),
    sanityFetch<ItemListQueryResult>({
      query: `*[${condition}] | order(coalesce(featured,false) desc,${key} ${direction})[$start...$end]{${itemSimpleFields}}`,
      params,
    }),
  ]);
  return { items, totalCount };
}
