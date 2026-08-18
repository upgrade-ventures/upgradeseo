import type {
  PromptExplorerModel,
  WebSearchCountryCode,
} from "@/types/schemas/ai-search";

const MENTION_PLATFORM_LABELS: Record<"chat_gpt" | "google", string> = {
  chat_gpt: "ChatGPT",
  google: "Google AI Overview",
};

const MODEL_LABELS: Record<PromptExplorerModel, string> = {
  chat_gpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

export function formatPlatformLabel(platform: "chat_gpt" | "google"): string {
  return MENTION_PLATFORM_LABELS[platform];
}

export function formatModelLabel(model: PromptExplorerModel): string {
  return MODEL_LABELS[model];
}

const COUNTRY_LABELS: Record<WebSearchCountryCode, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  PT: "Portugal",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  BR: "Brazil",
  MX: "Mexico",
  IN: "India",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  ZA: "South Africa",
};

export function formatCountryLabel(code: WebSearchCountryCode): string {
  return COUNTRY_LABELS[code];
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

/** Render a count for display. Null/undefined renders as an em-dash. */
export function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return NUMBER_FORMATTER.format(value);
}
