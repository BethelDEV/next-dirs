import mql from "@microlink/mql";
import dotenv from "dotenv";
dotenv.config();

/**
 * Microlink API Integration
 *
 * This module provides functions to interact with the Microlink API,
 * allowing you to fetch metadata and screenshots from a given URL.
 *
 * Available functions:
 * - microlinkFetch: Fetches metadata such as title, description, logo, etc.
 * - microlinkInsights: Fetches insights such as technologies, languages, etc.
 * - microlinkScreenshot: Captures a screenshot of the webpage.
 * - microlinkFullpage: Captures a fullpage screenshot of the webpage.
 */

// https://microlink.io/docs/api/getting-started/overview
// test successfully: pnpm run microlink:fetch https://mkdirs.com
export const microlinkFetch = async (url: string) => {
  try {
    const { data } = await mql(url, {
      // information included:
      // - title: page title
      // - description: page description
      // - lang: page language
      // - author: author information
      // - publisher: publisher information
      // - image: main image
      // - logo: website logo
      // - url: normalized URL
    });
    console.log("microlinkFetch, url:", url, "data:", data);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${url}:`, error);
    return null;
  }
};

// https://microlink.io/docs/api/parameters/insights/technologies
// test successfully: pnpm run microlink:insights https://mkdirs.com
export const microlinkInsights = async (url: string) => {
  try {
    const { data } = await mql(url, {
      insights: {
        technologies: true,
      },
    });
    console.log(
      "microlinkInsights, url:",
      url,
      "data:",
      JSON.stringify(data, null, 2),
    );
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${url}:`, error);
    return null;
  }
};

// https://microlink.io/docs/api/parameters/screenshot
// test successfully: pnpm run microlink:screenshot https://mkdirs.com
export const microlinkScreenshot = async (url: string) => {
  try {
    const { data } = await mql(url, {
      screenshot: true,
    });
    console.log("microlinkScreenshot, url:", url, "data:", data);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${url}:`, error);
    return null;
  }
};

// https://microlink.io/docs/api/parameters/screenshot
// test failed: pnpm run microlink:fullpage https://mkdirs.com
export const microlinkFullpage = async (url: string) => {
  try {
    const { data } = await mql(url, {
      screenshot: {
        fullPage: true,
      },
    });
    console.log("microlinkFullpage, url:", url, "data:", data);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${url}:`, error);
    return null;
  }
};

// get operation from command line
const operation = process.argv[2];
// get url from command line (new)
const url = process.argv[3];

// run operation based on command line argument
const runOperation = async () => {
  switch (operation) {
    case "fetch":
      if (!url) {
        console.error("Please provide a URL as the second argument");
        return;
      }
      await microlinkFetch(url);
      break;
    case "insights":
      if (!url) {
        console.error("Please provide a URL as the second argument");
        return;
      }
      await microlinkInsights(url);
      break;
    case "screenshot":
      if (!url) {
        console.error("Please provide a URL as the second argument");
        return;
      }
      await microlinkScreenshot(url);
      break;
    case "fullpage":
      if (!url) {
        console.error("Please provide a URL as the second argument");
        return;
      }
      await microlinkFullpage(url);
      break;
    default:
      console.log(`
Available commands:
- fetch <url>: Fetch data from Microlink API for the specified URL
- insights <url>: Fetch insights from Microlink API for the specified URL
- screenshot <url>: Fetch screenshot from Microlink API for the specified URL
- fullpage <url>: Fetch fullpage screenshot from Microlink API for the specified URL
      `);
  }
};

// run operation
runOperation().catch(console.error);
