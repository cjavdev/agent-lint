// ---------- Crawl ----------

export interface CrawlConfig {
  maxDepth: number;
  maxPages: number;
  requestAlternates: string[];
  timeout: number;
  userAgent: string;
}

export interface AlternateResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

export interface CrawledPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  textContent: string;
  links: string[];
  sizeBytes: number;
  alternateRepresentations: Map<string, AlternateResponse>;
}

// ---------- Rules ----------

export type Severity = "error" | "warn" | "info";

export interface RuleResult {
  ruleId: string;
  message: string;
  severity: Severity;
  url?: string;
  metadata?: Record<string, unknown>;
  remediation?: string;
}

export interface SiteContext {
  targetUrl: string;
  pages: CrawledPage[];
  config: AgentLintConfig;
}

export interface AgentLintRule {
  id: string;
  category: string;
  severity: Severity;
  description: string;
  remediation: string;
  check(context: SiteContext): Promise<RuleResult[]>;
}

// ---------- Config ----------

export interface AgentLintConfig {
  maxDepth: number;
  maxPages: number;
  tokenThreshold: number;
  requestAlternates: string[];
  rules: Record<string, { severity?: Severity; enabled?: boolean }>;
}

export const DEFAULT_CONFIG: AgentLintConfig = {
  maxDepth: 3,
  maxPages: 30,
  tokenThreshold: 4000,
  requestAlternates: ["text/markdown"],
  rules: {},
};

// ---------- Scoring ----------

export interface ScoreResult {
  score: number;
  grade: string;
  errors: number;
  warnings: number;
  infos: number;
}

// ---------- Reporting ----------

export interface ReportData {
  targetUrl: string;
  score: ScoreResult;
  results: RuleResult[];
  pageCount: number;
  duration: number;
}
