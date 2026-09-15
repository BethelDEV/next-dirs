import groq, { defineQuery } from "groq";

/**
 * https://www.sanity.io/plugins/next-sanity#using-query-result-types
 * https://www.sanity.io/plugins/next-sanity#generate-typescript-types
 */

// ======================================================================================================================

/**
 * Item Queries
 */
const tagFields = /* groq */ `
  ...,
`;

const categoryFields = /* groq */ `
  ...,
`;

export const groupFields = /* groq */ `
  ...,
  "categories": *[_type=='category' && references(^._id)] | order(priority desc, _createdAt asc)
  {
    ...,
  }
`;

export const collectionFields = /* groq */ `
  ...,
  icon {
    ...,
    "blurDataURL": asset->metadata.lqip,
    "imageColor": asset->metadata.palette.dominant.background,
  },
`;

// also used in file data/item.ts and data/submission.ts
export const itemSimpleFields = /* groq */ `
  _id,
  _createdAt,
  name,
  slug,
  description,
  link,
  affiliateLink,
  sponsor,
  sponsorStartDate,
  sponsorEndDate,
  featured,
  icon {
    ...,
    "blurDataURL": asset->metadata.lqip,
    "imageColor": asset->metadata.palette.dominant.background,
  },
  image {
    ...,
    "blurDataURL": asset->metadata.lqip,
    "imageColor": asset->metadata.palette.dominant.background,
  },
  publishDate,
  submitter{name,image,link},
  "collections": *[_type=="collection" && references(^._id)]{_id,name,slug},
  categories[]->,
  tags[]->,
`;

const itemFields = /* groq */ `
  ${itemSimpleFields}
  introduction,
`;

// auto generate related items
const itemFieldsWithRelated = /* groq */ `
  introduction,
  "related": *[_type == "item" && visible == true && defined(slug.current)
    && defined(publishDate)
    && visible == true
    && !(sponsor == true && sponsorStartDate <= now() && sponsorEndDate > now())
    && count(categories[@._ref in ^.categories[]._ref]) > 0 && _id != ^._id]
    | order(publishDate desc, _createdAt desc) [0...3] {
      ${itemSimpleFields}
  },
  ${itemSimpleFields}
`;

export const itemByIdQuery = defineQuery(`*[_type == "item" && visible == true && _id == $id][0] {
  ${itemSimpleFields}
}`);

export const itemInfoBySlugQuery = defineQuery(`*[_type == "item" && visible == true && slug.current == $slug][0] {
  ${itemSimpleFields}
}`);

export const itemFullInfoByIdQuery = defineQuery(`*[_type == "item" && visible == true && _id == $id][0] {
  ${itemFields}
}`);

export const itemFullInfoBySlugQuery = defineQuery(`*[_type == "item" && visible == true && slug.current == $slug
&& visible == true] [0] {
  ${itemFieldsWithRelated}
}`);

/**
 * NOTICE: this query is not used in the app,
 * but it is used to generate the type of ItemListQueryResult,
 * if you want to change this query, please update data/item.ts
 */
export const itemListQuery = defineQuery(`*[_type == "item" && visible == true && defined(slug.current)
  && defined(publishDate)
  && visible == true
  && !(sponsor == true && sponsorStartDate <= now() && sponsorEndDate > now())]
  | order(coalesce(featured, false) desc, publishDate desc) {
    ${itemSimpleFields}
}`);

// get sponsor items
export const sponsorItemListQuery = defineQuery(`*[_type == "item" && visible == true && defined(slug.current)
  && defined(publishDate)
  && visible == true
  && sponsor == true
  && sponsorStartDate <= now()
  && sponsorEndDate >= now()]
  | order(coalesce(featured, false) desc, publishDate desc) {
    ${itemSimpleFields}
}`);

export const itemListOfFeaturedQuery = defineQuery(`*[_type == "item" && visible == true && defined(slug.current)
  && defined(publishDate)
  && visible == true
  && !(sponsor == true && sponsorStartDate <= now() && sponsorEndDate > now())
  && featured == true]
  | order(coalesce(featured, false) desc, publishDate desc) [0...$count] {
    ${itemSimpleFields}
}`);

export const itemListOfLatestQuery = defineQuery(`*[_type == "item" && visible == true && defined(slug.current)
  && defined(publishDate)
  && visible == true
  && !(sponsor == true && sponsorStartDate <= now() && sponsorEndDate > now())]
  | order(coalesce(featured, false) desc, publishDate desc) [0...$count] {
    ${itemSimpleFields}
}`);

export const collectionListQuery = defineQuery(`*[_type == "collection" && defined(slug.current)]
  | order(priority desc) {
    ${collectionFields}
}`);

export const collectionQuery = defineQuery(`*[_type == "collection" && slug.current == $slug][0] {
  ${collectionFields}
}`);

export const groupListQuery = groq`*[_type=="group"] | order(priority desc, _createdAt asc) {
  ${groupFields}
}`;

export const categoryListQuery = defineQuery(`*[_type == "category" && defined(slug.current)]
  | order(priority desc) {
    ${categoryFields}
}`);

export const categoryQuery = defineQuery(`*[_type == "category" && slug.current == $slug][0] {
  ${categoryFields}
}`);

export const tagListQuery = defineQuery(`*[_type == "tag" && defined(slug.current)]
  | order(slug.current asc) {
    ${tagFields}
}`);

export const tagQuery = defineQuery(`*[_type == "tag" && slug.current == $slug][0] {
  ${tagFields}
}`);

// ======================================================================================================================

// Page Queries
export const pageQuery = defineQuery(`
  *[_type == "page" && slug.current == $slug][0] {
    ...,
    body[]{
      ...,
      markDefs[]{
        ...,
        _type == "internalLink" => {
          "slug": @.reference->slug
        }
      }
    },
  }
`);

// ======================================================================================================================

/**
 * Blog Queries
 */

// also used in file data/blog.ts
export const blogPostSimpleFields = /* groq */ `
  _id,
  _createdAt,
  title,
  slug,
  excerpt,
  featured,
  image {
    ...,
    "blurDataURL": asset->metadata.lqip,
    "imageColor": asset->metadata.palette.dominant.background,
  },
  publishDate,
  author->{_id,name,image,link},
  categories[]->,
`;

const blogPostFields = /* groq */ `
  relatedPosts[]-> {
    ${blogPostSimpleFields}
  },
  body[]{
    ...,
    markDefs[]{
      ...,
      _type == "internalLink" => {
        "slug": @.reference->slug
      }
    }
  },
  ${blogPostSimpleFields}

  // "estReadingTime": round(length(pt::text(body)) / 5 / 180 ),
  // "related": *[_type == "blogPost" && count(categories[@._ref in ^.categories[]._ref]) > 0 ] | order(publishDate desc, _createdAt desc) [0...2] {
  //   slug,
  //   title,
  //   excerpt,
  //   publishDate,
  //   "date": coalesce(publishedDate, _createdAt),
  //   "image": image
  // },
`;

const blogCategoryFields = /* groq */ `
  name,
  slug,
  description,
  priority,
`;

export const blogCategoryListQuery = defineQuery(`
  *[_type == "blogCategory" && defined(slug.current)]
  | order(priority desc) {
    ${blogCategoryFields}
}`);

export const blogCategoryMetadateQuery = defineQuery(`
  *[_type == "blogCategory" && slug.current == $slug][0] {
    ${blogCategoryFields}
  }
`);

export const blogPostQuery = defineQuery(`
  *[_type == "blogPost" && slug.current == $slug][0] {
    ${blogPostFields}
}`);

export const blogPostMetadataQuery = defineQuery(`
  *[_type == "blogPost" && slug.current == $slug][0] {
    ${blogPostSimpleFields}
}`);

/**
 * NOTICE: this query is not directly used in the app,
 * but it is used to generate the type of BlogPostListQueryResult,
 * if you want to change this query, please update data/blog.ts
 */
export const blogPostListQuery = defineQuery(`
  *[_type == "blogPost" && defined(slug.current) && defined(publishDate)]
  | order(publishDate desc) {
    ${blogPostSimpleFields}
}`);

export const blogPostListOfLatestQuery = defineQuery(`
  *[_type == "blogPost" && defined(slug.current) && defined(publishDate)]
  | order(publishDate desc) [0...$count] {
    ${blogPostSimpleFields}
}`);

// search blog posts by keywords, not used in the app
export const searchBlogQuery = groq`
  *[_type == "blogPost" && defined(slug.current) && defined(publishDate) && _score > 0]
  | score(title match $query || excerpt match $query || pt::text(body) match $query)
  | order(_score desc) {
  _score,
  ${blogPostSimpleFields}
}`;

// get top 5 categories, not used in the app
export const blogCategoryWithCountQuery = groq`
  *[_type == "blogCategory"] {
  ${blogCategoryFields}
  "count": count(*[_type == "blogPost" && references(^._id)])
} | order(count desc) [0...5]`;

// ======================================================================================================================

/**
 * Sitemap Queries
 */

export const itemListQueryForSitemap = groq`*[_type == "item" && visible == true && defined(slug.current) && defined(publishDate)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
}`;

export const categoryListQueryForSitemap = groq`*[_type == "category" && defined(slug.current)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
  "count": count(*[_type == "item" && visible == true && defined(publishDate) && visible == true && references(^._id)])
}`;

export const tagListQueryForSitemap = groq`*[_type == "tag" && defined(slug.current)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
  "count": count(*[_type == "item" && visible == true && defined(publishDate) && visible == true && references(^._id)])
}`;

export const collectionListQueryForSitemap = groq`*[_type == "collection" && defined(slug.current)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
  "count": count(*[_type == "item" && visible == true && defined(publishDate) && visible == true && _id in ^.items[]._ref])
}`;

export const blogListQueryForSitemap = groq`*[_type == "blogPost" && defined(slug.current) && defined(publishDate)] | order(publishDate desc, _createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
}`;

export const blogCategoryListQueryForSitemap = groq`*[_type == "blogCategory" && defined(slug.current)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
  "count": count(*[_type == "blogPost" && defined(publishDate) && references(^._id)])
}`;

export const pageListQueryForSitemap = groq`*[_type == "page" && defined(slug.current)] | order(_createdAt asc) {
  _id,
  _updatedAt,
  "slug": slug.current,
}`;

// ======================================================================================================================
