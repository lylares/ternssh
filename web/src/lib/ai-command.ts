import { api } from "@/lib/api";
import type { AiCommandWidgetConfig } from "@/lib/ai-command-config";

export interface GenerateCommandOptions {
  prompt: string;
  history?: string[];
  settings: AiCommandWidgetConfig;
  signal?: AbortSignal;
}

export class AiCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiCommandError";
  }
}

export async function generateShellCommand(
  options: GenerateCommandOptions,
): Promise<string> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new AiCommandError("Prompt is required");
  }

  const apiKey = options.settings.apiKey.trim();
  const model = options.settings.model.trim();
  const apiBaseUrl = options.settings.apiBaseUrl.trim();

  if (!apiBaseUrl || !apiKey) {
    throw new AiCommandError("AI API is not configured");
  }
  if (!model) {
    throw new AiCommandError("AI model is not configured");
  }

  try {
    const response = await api.generateAiCommand(
      {
        prompt,
        history: options.history,
        apiBaseUrl,
        apiKey,
        model,
      },
      { signal: options.signal },
    );
    return response.command;
  } catch (error) {
    if (error instanceof AiCommandError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not a valid shell command")) {
      throw new AiCommandError("not-a-command");
    }
    throw new AiCommandError(
      message || "Failed to generate command",
    );
  }
}
