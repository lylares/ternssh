export interface AiCommandWidgetConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_AI_COMMAND_CONFIG: AiCommandWidgetConfig = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function parseAiCommandConfig(
  configJson: string | null | undefined,
): AiCommandWidgetConfig {
  if (!configJson) return { ...DEFAULT_AI_COMMAND_CONFIG };
  try {
    const parsed = JSON.parse(configJson) as Partial<AiCommandWidgetConfig>;
    return {
      apiBaseUrl:
        typeof parsed.apiBaseUrl === "string" && parsed.apiBaseUrl.trim()
          ? normalizeBaseUrl(parsed.apiBaseUrl)
          : DEFAULT_AI_COMMAND_CONFIG.apiBaseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model.trim()
          : DEFAULT_AI_COMMAND_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_AI_COMMAND_CONFIG };
  }
}

export function serializeAiCommandConfig(
  config: AiCommandWidgetConfig,
): string {
  return JSON.stringify({
    apiBaseUrl:
      normalizeBaseUrl(config.apiBaseUrl) || DEFAULT_AI_COMMAND_CONFIG.apiBaseUrl,
    apiKey: config.apiKey,
    model: config.model.trim() || DEFAULT_AI_COMMAND_CONFIG.model,
  });
}

export function isAiConfigured(config: AiCommandWidgetConfig): boolean {
  return Boolean(config.apiBaseUrl.trim() && config.apiKey.trim());
}
