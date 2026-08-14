import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set.");
  }

  const clientOptions: ClientOptions = { apiKey };

  if (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    clientOptions.baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  }

  client = new Anthropic(clientOptions);
  return client;
}
