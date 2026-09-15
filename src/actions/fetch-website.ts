"use server";

import { limitAction } from "@/db/identity";
import { publicWebsiteUrl } from "@/lib/public-url";
import type { Category, Tag } from "@/sanity.types";
import { sanityClient } from "@/sanity/lib/client";
import { requireActor } from "@/services/listing-actions";
import { fetchPublicBytes } from "@/services/public-fetch";
import { uploadImage } from "@/services/uploads";
import { deepseek } from "@ai-sdk/deepseek";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Website info schema
 *
 * 1. when AI generates the image and icon, it will return the image URL and icon URL
 * 2. when the image and icon are uploaded to Sanity, the image reference Id and icon reference Id will be set to the image and icon
 * 3. when this server action is called, it will return the image url and icon url, and the image reference Id and icon reference Id
 */
const WebsiteInfoSchema = z.object({
  name: z
    .string()
    .max(32)
    .describe("A short, concise name without description"),
  description: z
    .string()
    .max(160)
    .describe("One sentence summary, max 160 characters"),
  introduction: z
    .string()
    .max(4096)
    .describe("Detailed introduction in markdown format"),
  categories: z
    .array(z.string())
    .describe("Array of category names that best match the content"),
  tags: z
    .array(z.string())
    .describe("Array of tag names that best match the content"),
  image: z.string().describe("Website screenshot image URL"),
  icon: z.string().describe("Website logo image URL"),
  imageId: z
    .string()
    .optional()
    .describe("Website screenshot image reference Id"),
  iconId: z.string().optional().describe("Website logo image reference Id"),
});

export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
  data?: z.infer<typeof WebsiteInfoSchema>;
};

/**
 * fetch info for the specified url
 */
export async function fetchWebsite(url: string): Promise<ServerActionResponse> {
  try {
    if (!process.env.DEFAULT_AI_PROVIDER) {
      return {
        status: "error",
        message: "AI submit is not supported",
      };
    }

    publicWebsiteUrl(url);
    const { db, actor } = await requireActor();
    if (!(await limitAction(db, `ai:${actor.id}`, 5, 86400)))
      return { status: "error", message: "Daily AI limit reached" };
    const data = await fetchWebsiteInfo(url);
    if (data === null) {
      return {
        status: "error",
        message: "Failed to fetch website info",
      };
    }
    return {
      status: "success",
      message: "Successfully fetched website info",
      data,
    };
  } catch (error) {
    console.error("Website assistance failed");
    return {
      status: "error",
      message: "Failed to fetch website info",
    };
  }
}

/**
 * fetch website info for the specified url with Microlink and AI SDK
 */
const fetchWebsiteInfo = async (url: string) => {
  const fetchedData = await fetchWebsiteInfoWithAI(url);
  if (fetchedData === null) {
    console.error("Website extraction failed");
    return null;
  }

  const websiteInfo = WebsiteInfoSchema.parse({
    name: fetchedData.object.name,
    description: fetchedData.object.description,
    introduction: fetchedData.object.introduction,
    categories: fetchedData.object.categories,
    tags: fetchedData.object.tags,
    // image: microlinkData?.image?.url, // maybe we can use Microlink to get the screenshot as fallback
    image: fetchedData.object.image,
    // icon: microlinkData?.logo?.url, // maybe we can use Microlink to get the logo as fallback
    // TODO: we don't use favicon URL, instead, we use Google API to get the logo
    icon: `https://s2.googleusercontent.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=128`,
  });

  if (websiteInfo.image && websiteInfo.icon) {
    const { db, actor } = await requireActor();
    const iconData = await fetchPublicBytes(websiteInfo.icon, 5 * 1024 * 1024);
    const imageData = await fetchPublicBytes(
      websiteInfo.image,
      5 * 1024 * 1024,
    );
    const iconAsset = await uploadImage(
      db,
      actor,
      iconData.bytes,
      iconData.type,
    );
    const imageAsset = await uploadImage(
      db,
      actor,
      imageData.bytes,
      imageData.type,
    );

    websiteInfo.icon = iconAsset.url;
    websiteInfo.image = imageAsset.url;
    websiteInfo.iconId = iconAsset._id;
    websiteInfo.imageId = imageAsset._id;
  }

  return websiteInfo;
};

/**
 * fetch website info for the specified url with AI SDK
 */
const fetchWebsiteInfoWithAI = async (url: string) => {
  try {
    // get all categories and tags
    const categories = await sanityClient.fetch<Category[]>(
      `*[_type == "category"]`,
    );
    const tags = await sanityClient.fetch<Tag[]>(`*[_type == "tag"]`);
    const availableCategories = categories.map((cat) => cat.name);
    const availableTags = tags.map((tag) => tag.name);

    const response = await fetchPublicBytes(url, 256 * 1024);
    const htmlContent = new TextDecoder()
      .decode(response.bytes)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .slice(0, 32000);
    const modelName = process.env.AI_MODEL;
    if (!modelName) return null;

    let aiModel = null;
    if (
      process.env.DEFAULT_AI_PROVIDER === "google" &&
      process.env.GOOGLE_GENERATIVE_AI_API_KEY !== undefined
    ) {
      // https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
      aiModel = google(modelName, {
        structuredOutputs: true,
      });
    } else if (
      process.env.DEFAULT_AI_PROVIDER === "deepseek" &&
      process.env.DEEPSEEK_API_KEY !== undefined
    ) {
      // https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
      aiModel = deepseek(modelName, {
        // structuredOutputs: true,
      });
    } else if (
      process.env.DEFAULT_AI_PROVIDER === "openai" &&
      process.env.OPENAI_API_KEY !== undefined
    ) {
      // https://ai-sdk.dev/providers/ai-sdk-providers/openai
      aiModel = openai(modelName, {
        structuredOutputs: true,
      });
    } else if (
      process.env.DEFAULT_AI_PROVIDER === "xai" &&
      process.env.XAI_API_KEY !== undefined
    ) {
      // https://ai-sdk.dev/providers/ai-sdk-providers/xai
      aiModel = xai(modelName, {
        // structuredOutputs: true,
      });
    } else if (
      process.env.DEFAULT_AI_PROVIDER === "openrouter" &&
      process.env.OPENROUTER_API_KEY !== undefined &&
      modelName !== undefined
    ) {
      // https://ai-sdk.dev/providers/community-providers/openrouter
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      aiModel = openrouter(modelName);
    }

    if (aiModel === null) {
      return null;
    }

    const result = await generateObject({
      model: aiModel,
      maxTokens: 2500,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30000),
      schema: WebsiteInfoSchema,
      prompt: `Analyze the following webpage content and provide structured information:
      
      Content to analyze:
      ${htmlContent}
      
      Available Categories:
      ${availableCategories.join(", ")}
      
      Available Tags:
      ${availableTags.join(", ")}
      
      Please analyze the content and provide:
      1. A concise title (just the name, no description)
      2. A brief description (one sentence, max 160 characters)
      3. A detailed introduction in markdown format (include key features and use cases)
      4. Select appropriate categories from the available categories list (return array of names)
      5. Select relevant tags from the available tags list (return array of names)
      6. Provide a screenshot image full URL, choose open graph image URL if possible
      7. Provide a website logo full URL, choose website favicon URL if possible
      
      Focus on technical aspects and practical applications. If the content is a tool or service, 
      emphasize its main features, target users, and unique selling points.`,
    });

    // console.log("fetchWebsiteInfoWithAI, url:", url, "result:", result);

    // filter AI generated categories and tags to make sure they are in the available categories and tags
    const filteredCategories = result.object.categories.filter((category) =>
      availableCategories.includes(category),
    );
    const filteredTags = result.object.tags.filter((tag) =>
      availableTags.includes(tag),
    );
    result.object.categories = filteredCategories;
    result.object.tags = filteredTags;

    return result;
  } catch (error) {
    console.error("AI extraction failed");
    return null;
  }
};
