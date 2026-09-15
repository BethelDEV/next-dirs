// show more logs
export const SHOW_QUERY_LOGS = false;
// support AI submit, default is false
// NOTE: if you set true, you should make sure the AI provider
// and the API_KEY is set in the env variables.
// if something is wrong in AI submit, you can set false to disable it.
export const SUPPORT_AI_SUBMIT = false;
// support category group, default is true (aka, show category group)
// NOTE: if you set true, you should make sure each category belongs to a group
// if you set false, the category will be shown in the root level
export const SUPPORT_CATEGORY_GROUP = true;
// support item icon, default is true (aka, show item icon)
// NOTE: if you set true, you should make sure the item icon is available
export const SUPPORT_ITEM_ICON = true;
// number of items per page
export const ITEMS_PER_PAGE = 12;
// number of collections per page
export const COLLECTIONS_PER_PAGE = 12;
// number of posts per page
export const POSTS_PER_PAGE = 6;
// number of submissions per page
export const SUBMISSIONS_PER_PAGE = 3;

export type SortFilterItem = {
  label: string;
  slug: string | null;
  sortKey: "publishDate" | "name"; // | 'stars' | '_createdAt' | '_updatedAt'
  reverse: boolean;
};

export const DEFAULT_SORT: SortFilterItem = {
  label: "Sort by Time (dsc)",
  slug: null,
  sortKey: "publishDate",
  reverse: true,
};

export const SORT_FILTER_LIST: SortFilterItem[] = [
  DEFAULT_SORT,
  {
    label: "Sort by Time (asc)",
    slug: "date-asc",
    sortKey: "publishDate",
    reverse: false,
  },
  {
    label: "Sort by Name (dsc)",
    slug: "name-desc",
    sortKey: "name",
    reverse: true,
  },
  {
    label: "Sort by Name (asc)",
    slug: "name-asc",
    sortKey: "name",
    reverse: false,
  },
];

export type QueryFilterItem = {
  label: string;
  slug: string | null;
};

export const DEFAULT_QUERY: QueryFilterItem = {
  label: "No Filter",
  slug: null,
};

export const QUERY_FILTER_LIST: QueryFilterItem[] = [
  DEFAULT_QUERY,
  {
    label: "Featured",
    slug: "featured==true",
  },
];
