import blockContent from "./documents/block-content";
import blogCategory from "./documents/blog/blog-category";
import blogPost from "./documents/blog/blog-post";
import publicProfile from "./documents/blog/public-profile";
import category from "./documents/directory/category";
import collection from "./documents/directory/collection";
import group from "./documents/directory/group";
import item from "./documents/directory/item";
import tag from "./documents/directory/tag";
import page from "./documents/page/page";
import settings from "./documents/settings";

export const schemaTypes = [
  // directory
  item,
  tag,
  category,
  group,
  collection,

  // blog
  blogPost,
  blogCategory,

  // page
  page,

  publicProfile,

  // others
  settings,
  blockContent,
];
