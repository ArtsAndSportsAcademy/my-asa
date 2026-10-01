import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

/**
 * D1 do plano de lançamento: o dados-de-exemplo.json tem nomes reais do elenco (inclusive menores).
 * Ele alimenta só a amostra local (`import.meta.env.DEV && ?amostra=1`). No build de produção, todo
 * import dele vira esta versão vazia, com o mesmo formato — nenhum nome chega ao navegador.
 */
function semDadosDeExemplo(): Plugin {
  const VAZIO = "\0myasa-dados-de-exemplo-vazio";
  const formato = { locais: [], areas: [], supervisao_por_area_local: [], pessoas: [], shows: [], personagens: [], blocos_por_local: {} };
  return {
    name: "myasa-sem-dados-de-exemplo",
    apply: "build",
    enforce: "pre",
    resolveId(source) { return source.endsWith("dados-de-exemplo.json") ? VAZIO : null; },
    load(id) { return id === VAZIO ? `export default ${JSON.stringify(formato)};` : null; },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    semDadosDeExemplo(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "../.."),
      ],
    },
    // Só ativo em dev local, quando API_PROXY_TARGET é definido explicitamente —
    // encaminha /api para o api-server rodando à parte (ex.: verificação de ponta a
    // ponta fora de ?amostra=1). Produção usa o rewrite do vercel.json, não isto.
    proxy: process.env.API_PROXY_TARGET
      ? { "/api": { target: process.env.API_PROXY_TARGET, changeOrigin: true } }
      : undefined,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
