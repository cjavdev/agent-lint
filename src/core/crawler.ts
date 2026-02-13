import * as cheerio from "cheerio";
import type { CrawlConfig, CrawledPage, AlternateResponse } from "../types.js";

const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxDepth: 3,
  maxPages: 30,
  requestAlternates: ["text/markdown"],
  timeout: 10000,
  userAgent: "AgentLint/0.1",
};

interface QueueEntry {
  url: string;
  depth: number;
}

export async function crawl(
  startUrl: string,
  config: Partial<CrawlConfig> = {}
): Promise<CrawledPage[]> {
  const cfg: CrawlConfig = { ...DEFAULT_CRAWL_CONFIG, ...config };
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const queue: QueueEntry[] = [{ url: normalize(startUrl), depth: 0 }];

  while (queue.length > 0 && pages.length < cfg.maxPages) {
    const entry = queue.shift()!;
    const normalized = normalize(entry.url);

    if (visited.has(normalized)) continue;
    if (entry.depth > cfg.maxDepth) continue;
    visited.add(normalized);

    try {
      const page = await fetchPage(normalized, cfg, origin);
      if (!page) continue;
      pages.push(page);

      // Enqueue discovered links
      for (const link of page.links) {
        const normalizedLink = normalize(link);
        if (!visited.has(normalizedLink)) {
          queue.push({ url: normalizedLink, depth: entry.depth + 1 });
        }
      }
    } catch {
      // Skip pages that fail to fetch
    }
  }

  return pages;
}

async function fetchPage(
  url: string,
  config: CrawlConfig,
  origin: string
): Promise<CrawledPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": config.userAgent,
      },
      signal: controller.signal,
      redirect: "follow",
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove script and style tags for text extraction
    $("script, style").remove();
    const textContent = $("body").text().replace(/\s+/g, " ").trim();

    // Extract same-origin links
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const resolved = new URL(href, url).href;
        const normalized = normalize(resolved);
        if (new URL(normalized).origin === origin) {
          links.push(normalized);
        }
      } catch {
        // Ignore invalid URLs
      }
    });

    // Collect response headers
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Fetch alternate representations
    const alternateRepresentations = new Map<string, AlternateResponse>();
    for (const alt of config.requestAlternates) {
      try {
        const altRes = await fetch(url, {
          headers: {
            Accept: alt,
            "User-Agent": config.userAgent,
          },
          redirect: "follow",
        });
        const body = await altRes.text();
        const altHeaders: Record<string, string> = {};
        altRes.headers.forEach((value, key) => {
          altHeaders[key] = value;
        });
        alternateRepresentations.set(alt, {
          status: altRes.status,
          headers: altHeaders,
          body,
          contentType: altRes.headers.get("content-type") ?? "",
        });
      } catch {
        // Skip failed alternate requests
      }
    }

    return {
      url,
      status: res.status,
      headers,
      html,
      textContent,
      links: [...new Set(links)],
      sizeBytes: Buffer.byteLength(html, "utf-8"),
      alternateRepresentations,
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalize(url: string): string {
  const u = new URL(url);
  // Remove fragment
  u.hash = "";
  // Remove trailing slash (except for root)
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.href;
}
