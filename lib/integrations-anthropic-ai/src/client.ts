import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";

// API key is always required.
if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set.",
  );
}

// Base URL is optional. When set, it overrides the default Anthropic endpoint —
// useful for the Replit AI proxy or a custom gateway. When absent, the SDK
// uses the official API endpoint (https://api.anthropic.com) automatically.
const clientOptions: ClientOptions = {
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
};

if (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
  clientOptions.baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
}

export const anthropic = new Anthropic(clientOptions);
