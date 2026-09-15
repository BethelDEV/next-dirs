import { defineField, defineType } from "sanity";
export default defineType({
  name: "item",
  title: "Published catalog (managed by application)",
  type: "document",
  readOnly: true,
  fields: [
    defineField({ name: "name", type: "string" }),
    defineField({ name: "slug", type: "slug" }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "link", type: "url" }),
    defineField({ name: "affiliateLink", type: "url" }),
    defineField({ name: "introduction", type: "markdown" }),
    defineField({ name: "visible", type: "boolean" }),
    defineField({ name: "version", type: "number" }),
    defineField({ name: "publishDate", type: "datetime" }),
    defineField({ name: "featured", type: "boolean" }),
    defineField({ name: "sponsor", type: "boolean" }),
    defineField({ name: "sponsorStartDate", type: "datetime" }),
    defineField({ name: "sponsorEndDate", type: "datetime" }),
    defineField({
      name: "submitter",
      type: "object",
      fields: [
        { name: "name", type: "string" },
        { name: "image", type: "url" },
        { name: "link", type: "url" },
      ],
    }),
    ...["categories", "tags"].map((name) =>
      defineField({
        name,
        type: "array",
        of: [
          {
            type: "reference",
            to: [
              {
                type:
                  name === "categories"
                    ? "category"
                    : name === "tags"
                      ? "tag"
                      : "collection",
              },
            ],
          },
        ],
      }),
    ),
    ...["image", "icon"].map((name) =>
      defineField({
        name,
        type: "image",
        options: { hotspot: true },
        fields: [{ name: "alt", type: "string" }],
      }),
    ),
  ],
  preview: { select: { title: "name", media: "image" } },
});
