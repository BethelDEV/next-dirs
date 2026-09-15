import { CopyButton } from "@/components/shared/copy-button";
import { safeContentUrl } from "@/lib/content-url";
import { cn } from "@/lib/utils";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

/** Markdown is parsed as data. HTML/JSX/imports are never executed. */
export function CustomMdx({
  source,
  components,
}: { source?: string; components?: Components }) {
  if (!source) return null;
  return (
    <article className="markdown-content">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        urlTransform={(url, key) => safeContentUrl(url, key === "src")}
        components={{ ...markdownComponents, ...components }}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}

const markdownComponents = {
  h1: ({ node: _node, className, ...props }) => (
    <h1
      className={cn("mt-2 scroll-m-20 text-4xl font-bold", className)}
      {...props}
    />
  ),
  h2: ({ node: _node, className, ...props }) => (
    <h2
      className={cn(
        "mt-10 scroll-m-20 text-3xl font-semibold border-b pb-1 first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3
      className={cn("mt-8 scroll-m-20 text-2xl font-semibold", className)}
      {...props}
    />
  ),
  h4: ({ node: _node, className, ...props }) => (
    <h4
      className={cn("mt-8 scroll-m-20 text-xl font-semibold", className)}
      {...props}
    />
  ),
  h5: ({ node: _node, className, ...props }) => (
    <h5
      className={cn("mt-8 scroll-m-20 text-lg font-semibold", className)}
      {...props}
    />
  ),
  h6: ({ node: _node, className, ...props }) => (
    <h6
      className={cn("mt-8 scroll-m-20 text-base font-semibold", className)}
      {...props}
    />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={cn("font-medium underline underline-offset-4", className)}
      {...props}
    />
  ),
  p: ({ node: _node, className, ...props }) => (
    <p
      className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
      {...props}
    />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul className={cn("my-6 ml-6 list-disc", className)} {...props} />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol className={cn("my-6 ml-6 list-decimal", className)} {...props} />
  ),
  li: ({ node: _node, className, ...props }) => (
    <li className={cn("mt-2", className)} {...props} />
  ),
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote
      className={cn(
        "mt-6 border-l-2 pl-6 italic [&>*]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  img: ({
    node: _node,
    className,
    alt,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) =>
    props.src ? (
      // biome-ignore lint/a11y/useAltText: <explanation>
      <img
        className={cn("rounded-md border my-2", className)}
        alt={alt || "Image"}
        title={alt || "Image"}
        {...props}
      />
    ) : null,
  hr: ({ node: _node, ...props }) => <hr className="my-4 md:my-8" {...props} />,
  table: ({
    node: _node,
    className,
    ...props
  }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className={cn("w-full", className)} {...props} />
    </div>
  ),
  tr: ({
    node: _node,
    className,
    ...props
  }: React.HTMLAttributes<HTMLTableRowElement> & { node?: unknown }) => (
    <tr
      className={cn("m-0 border-t p-0 even:bg-muted", className)}
      {...props}
    />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={cn(
        "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={cn(
        "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  pre: ({
    node: _node,
    className,
    __rawString__,
    ...props
  }: React.HTMLAttributes<HTMLPreElement> & {
    __rawString__?: string;
    node?: unknown;
  }) => (
    <div className="group relative w-full overflow-hidden">
      <pre
        className={cn(
          "max-h-[650px] overflow-x-auto rounded-lg border bg-zinc-900 py-4 dark:bg-zinc-900",
          className,
        )}
        {...props}
      />
      {__rawString__ && (
        <CopyButton
          value={__rawString__}
          className={cn(
            "absolute right-4 top-4 z-20",
            "duration-250 opacity-0 transition-all group-hover:opacity-100",
          )}
        />
      )}
    </div>
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={cn(
        "relative rounded-md border bg-muted px-[0.4rem] py-1 font-mono text-sm text-foreground",
        className,
      )}
      {...props}
    />
  ),
};
