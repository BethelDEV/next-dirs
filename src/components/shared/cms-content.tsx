import { safeContentUrl } from "@/lib/content-url";
import { urlForImage } from "@/lib/image";
import {
  PortableText,
  type PortableTextComponents,
  type PortableTextProps,
} from "@portabletext/react";

const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => <h2>{children}</h2>,
    h2: ({ children }) => <h3>{children}</h3>,
    h3: ({ children }) => <h4>{children}</h4>,
  },
  marks: {
    link: ({ value, children }) => (
      <a href={safeContentUrl(value?.href ?? "")} rel="noopener noreferrer">
        {children}
      </a>
    ),
    internalLink: ({ value, children }) => (
      <a href={safeContentUrl(`/${value?.slug?.current ?? ""}`)}>{children}</a>
    ),
  },
  types: {
    image: ({ value }) => {
      const src = safeContentUrl(urlForImage(value)?.src ?? "", true);
      return src ? (
        <img src={src} alt={value.alt || ""} loading="lazy" />
      ) : null;
    },
    code: ({ value }) => (
      <pre>
        <code>{value.code}</code>
      </pre>
    ),
  },
};

export function CmsContent({ value }: { value: PortableTextProps["value"] }) {
  return (
    <article className="prose dark:prose-invert max-w-none">
      <PortableText value={value} components={components} />
    </article>
  );
}
