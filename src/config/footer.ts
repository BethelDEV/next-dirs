import type { FooterConfig } from "@/types";

export const footerConfig: FooterConfig = {
  links: [
    {
      title: "Product",
      items: [
        { title: "Search", href: "/search" },
        { title: "Collection", href: "/collection" },
        { title: "Category", href: "/category" },
        { title: "Tag", href: "/tag" },
      ],
    },
    {
      title: "Resources",
      items: [
        { title: "Blog", href: "/blog" },
        { title: "Pricing", href: "/pricing" },
        { title: "Submit", href: "/submit" },
        { title: "Studio", href: "/studio", external: true },
      ],
    },
    {
      title: "Pages",
      items: [
        { title: "Home 2", href: "/home2" },
        { title: "Home 3", href: "/home3" },
        {
          title: "Collection 1",
          href: "/collection/the-best-google-analytics-alternatives-in-2024",
        },
        {
          title: "Collection 2",
          href: "/collection/the-best-alternatives-to-semrush-in-2024",
        },
      ],
    },
    {
      title: "Company",
      items: [
        { title: "About Us", href: "/about" },
        { title: "Privacy Policy", href: "/privacy" },
        { title: "Terms of Service", href: "/terms" },
        { title: "Sitemap", href: "/sitemap.xml" },
      ],
    },
  ],
};
