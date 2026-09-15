import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "./api";
// Public content reads never carry a write token or preview credentials.
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  perspective: "published",
  useCdn: false,
});
