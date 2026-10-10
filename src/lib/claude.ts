import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic();
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** Single structured-output call; returns the parsed JSON. */
export async function askJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: opts.schema } },
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined the request");
  if (res.stop_reason === "max_tokens") throw new Error("Model output was truncated");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No text in model response");
  return JSON.parse(text.text) as T;
}
