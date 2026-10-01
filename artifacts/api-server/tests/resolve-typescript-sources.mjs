import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") || !specifier.endsWith(".js") || !context.parentURL?.startsWith("file:")) {
      throw error;
    }

    const sourceUrl = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
    try {
      await access(fileURLToPath(sourceUrl));
      return { url: sourceUrl.href, shortCircuit: true };
    } catch {
      throw error;
    }
  }
}
