import { dataset, projectId } from "@/sanity/lib/api";
import { defineCliConfig } from "sanity/cli";

// Local schema/type generation only. Studio is served by the Worker at /studio.
export default defineCliConfig({
  api: { projectId, dataset },
  typegen: {
    path: "src/sanity/lib/queries.ts",
    generates: "sanity.types.ts",
    schema: "schema.json",
    overloadClientMethods: true,
  },
});
