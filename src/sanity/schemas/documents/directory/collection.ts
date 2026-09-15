import { format, parseISO } from "date-fns";
import { defineField, defineType } from "sanity";

export default defineType({
  name: "collection",
  title: "Collection",
  type: "document",
  fields: [
    defineField({
      name: "items",
      title: "Published listings",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "item" }],
          options: { filter: "visible == true" },
        },
      ],
    }),
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "name",
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "icon",
      title: "Icon",
      type: "image",
      fields: [
        defineField({
          name: "items",
          title: "Published listings",
          type: "array",
          of: [
            {
              type: "reference",
              to: [{ type: "item" }],
              options: { filter: "visible == true" },
            },
          ],
        }),
        {
          name: "alt",
          type: "string",
          title: "Alternative Text",
          description: "Important for SEO and accessiblity",
          initialValue: (_, parent) => {
            return `Icon for ${parent?.name || "item"}`;
          },
        },
      ],
    }),
    defineField({
      name: "priority",
      title: "Priority",
      type: "number",
      description: "Priority of the collection, used to sort the collections",
      initialValue: 0,
    }),
  ],
  preview: {
    select: {
      name: "name",
      icon: "icon",
      priority: "priority",
      date: "_createdAt",
    },
    prepare({ name, icon, priority, date }) {
      const title = `${priority} - ${name}`;
      const subtitle = format(parseISO(date), "yyyy/MM/dd");
      return {
        title,
        media: icon,
        subtitle,
      };
    },
  },
  orderings: [
    {
      title: "Priority",
      name: "priority",
      by: [{ field: "priority", direction: "desc" }],
    },
    {
      title: "Name",
      name: "name",
      by: [{ field: "name", direction: "asc" }],
    },
  ],
});
