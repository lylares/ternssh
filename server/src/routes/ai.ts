import { Hono } from "hono";
import { AiCommandError, generateShellCommand } from "../lib/ai-command";
import { jsonError } from "../lib/http";
import type { Variables } from "../types";

export const aiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiRoutes.post("/generate-command", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    prompt?: unknown;
    history?: unknown;
    apiBaseUrl?: unknown;
    apiKey?: unknown;
    model?: unknown;
  } | null;

  if (typeof body?.prompt !== "string") {
    return jsonError(c, 400, "Prompt is required");
  }
  if (typeof body.apiBaseUrl !== "string") {
    return jsonError(c, 400, "API base URL is required");
  }
  if (typeof body.apiKey !== "string") {
    return jsonError(c, 400, "API key is required");
  }
  if (typeof body.model !== "string") {
    return jsonError(c, 400, "Model is required");
  }

  const history = Array.isArray(body.history)
    ? body.history.filter((item): item is string => typeof item === "string")
    : [];

  try {
    const command = await generateShellCommand({
      prompt: body.prompt,
      history,
      apiBaseUrl: body.apiBaseUrl,
      apiKey: body.apiKey,
      model: body.model,
    });
    return c.json({ command });
  } catch (error) {
    if (error instanceof AiCommandError) {
      return jsonError(c, 400, error.message);
    }
    console.error("generate ai command failed", error);
    return jsonError(
      c,
      502,
      error instanceof Error ? error.message : "Failed to generate command",
    );
  }
});
