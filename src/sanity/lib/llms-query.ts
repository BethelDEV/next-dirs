import { LLMS_FULL_PAGE_SIZE, LLMS_INDEX_PAGE_SIZE } from "../../lib/llms";

const publicFilter = `
  _type == $type && defined(slug.current) && slug.current != ""
  && !(_id in path("drafts.**")) && !(_id in path("versions.**"))
  && (_type != "item" || (visible == true && defined(publishDate)))
  && (_type != "blogPost" || defined(publishDate))
`;
const summaryFields = `_id, _type, "slug": slug.current,
  "title": coalesce(name, title), "description": coalesce(description, excerpt)`;
const fullFields = `${summaryFields},
  "introduction": select(_type == "item" => introduction),
  "body": select(_type in ["blogPost", "page"] => body[]{
    _type, style, listItem,
    children[]{text, marks}, markDefs[]{_key, _type, href},
    code, language, alt
  })`;

// One extra metadata record detects continuation without counting the catalog.
export function llmsQuery(full: boolean) {
  const limit = (full ? LLMS_FULL_PAGE_SIZE : LLMS_INDEX_PAGE_SIZE) + 1;
  return `*[${publicFilter} && _id > $after] | order(_id asc) [0...${limit}] { ${summaryFields} }`;
}

// Every body read rechecks visibility; no whole-document spreads.
export const llmsDocumentQuery = `*[${publicFilter} && slug.current == $slug] | order(_id asc) [0] { ${fullFields} }`;
export const llmsDocumentByIdQuery = `*[${publicFilter} && _id == $id][0] { ${fullFields} }`;
