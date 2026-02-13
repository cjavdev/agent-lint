import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { AgentLintConfig } from "../types.js";

const ruleConfigSchema = z
  .object({
    severity: z.enum(["error", "warn", "info"]).optional(),
    enabled: z.boolean().optional(),
    ignorePaths: z.array(z.string()).optional(),
  })
  .strict();

const configFileSchema = z
  .object({
    maxDepth: z.number().int().positive().optional(),
    maxPages: z.number().int().positive().optional(),
    tokenThreshold: z.number().int().positive().optional(),
    requestAlternates: z.array(z.string()).optional(),
    rules: z.record(z.string(), ruleConfigSchema).optional(),
    ignorePatterns: z.array(z.string()).optional(),
  })
  .strict();

export type ConfigFile = z.infer<typeof configFileSchema>;

const SEARCH_FILES = ["agentlint.config.json", ".agentlintrc.json"];

async function tryReadJson(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadConfig(
  explicitPath?: string,
  cwd: string = process.cwd()
): Promise<Partial<AgentLintConfig>> {
  // If explicit path given, it must exist and be valid
  if (explicitPath) {
    const fullPath = resolve(cwd, explicitPath);
    const raw = await tryReadJson(fullPath);
    if (raw === null) {
      throw new Error(`Config file not found or invalid JSON: ${fullPath}`);
    }
    const parsed = configFileSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid config in ${fullPath}:\n${issues}`);
    }
    return parsed.data as Partial<AgentLintConfig>;
  }

  // Search for config files in CWD
  for (const filename of SEARCH_FILES) {
    const fullPath = resolve(cwd, filename);
    const raw = await tryReadJson(fullPath);
    if (raw === null) continue;

    const parsed = configFileSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid config in ${fullPath}:\n${issues}`);
    }
    return parsed.data as Partial<AgentLintConfig>;
  }

  // No config file found — return empty (will use defaults)
  return {};
}
