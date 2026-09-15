import { renderToStaticMarkup } from "react-dom/server";
import { CustomMdx } from "./custom-mdx";

/** EasyMDE inserts preview HTML directly; use the same safe renderer as readers. */
export function renderMarkdownPreview(source: string) {
  return renderToStaticMarkup(<CustomMdx source={source} />);
}
