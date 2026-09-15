import { defineField, defineType } from "sanity";
export default defineType({
  name: "publicProfile",
  title: "Public author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "image",
      type: "url",
      description: "Public avatar URL",
    }),
    defineField({ name: "link", type: "url" }),
  ],
  preview: { select: { title: "name" } },
});
