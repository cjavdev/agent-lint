#!/usr/bin/env node
import { Command } from "commander";
import ora from "ora";
import { crawl } from "./core/crawler.js";
import { buildSiteContext, discoverRules, analyze } from "./core/analyzer.js";
import { computeScore } from "./core/scorer.js";
import { formatConsoleReport } from "./reporters/console.js";
import type { ReportData } from "./types.js";

const program = new Command();

program
  .name("agentlint")
  .description("Audit websites for AI/agent-friendliness")
  .version("0.1.0")
  .argument("<url>", "URL to audit")
  .option("--max-depth <n>", "Maximum crawl depth", "3")
  .option("--max-pages <n>", "Maximum pages to crawl", "50")
  .option("--json", "Output as JSON")
  .action(async (url: string, opts: Record<string, string>) => {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith("http")) {
        throw new Error("URL must use http or https");
      }
    } catch {
      console.error(
        `Error: Invalid URL "${url}". Provide a full URL like https://example.com`
      );
      process.exit(2);
    }

    const maxDepth = parseInt(opts.maxDepth, 10);
    const maxPages = parseInt(opts.maxPages, 10);
    const isCI = !!process.env.CI;

    const spinner = ora({
      text: `Crawling ${parsedUrl.href}...`,
      isSilent: isCI,
    }).start();

    const startTime = Date.now();

    try {
      // Crawl
      spinner.text = `Crawling ${parsedUrl.href}...`;
      const pages = await crawl(parsedUrl.href, {
        maxDepth,
        maxPages,
        requestAlternates: ["text/markdown"],
      });

      spinner.text = `Analyzing ${pages.length} page${pages.length !== 1 ? "s" : ""}...`;

      // Build context
      const context = buildSiteContext(parsedUrl.href, pages, {
        maxDepth,
        maxPages,
        requestAlternates: ["text/markdown"],
      });

      // Discover and run rules
      const rules = await discoverRules();
      const results = await analyze(context, rules);

      // Score
      const score = computeScore(results);

      const duration = Date.now() - startTime;

      const reportData: ReportData = {
        targetUrl: parsedUrl.href,
        score,
        results,
        pageCount: pages.length,
        duration,
      };

      spinner.stop();

      // Output
      if (opts.json) {
        console.log(JSON.stringify(reportData, null, 2));
      } else {
        console.log(formatConsoleReport(reportData));
      }

      // Exit code
      process.exit(score.errors > 0 ? 1 : 0);
    } catch (err) {
      spinner.stop();
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(2);
    }
  });

program.parse();
