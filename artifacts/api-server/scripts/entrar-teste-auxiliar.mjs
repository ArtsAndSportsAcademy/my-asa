// Servidor temporário de teste: faz o login de uma conta teste.* da empresa de teste e devolve só a resposta da API.
// Nunca imprime a senha: ela é lida do arquivo local ignorado pelo git e vai direto para a API.
import http from "node:http";
import { readFileSync } from "node:fs";

const arquivo = process.env.SENHAS_ARQUIVO;
const api = process.env.API_URL ?? "http://127.0.0.1:3095";

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const url = new URL(req.url, "http://x");
    const quem = url.searchParams.get("quem") ?? "";
    const dados = JSON.parse(readFileSync(arquivo, "utf8"));
    const grupo = dados.empresa4locais ?? {};
    const senha = quem === "teste.admin" && grupo.admin?.senha ? grupo.admin.senha : grupo.senhaDasContasTeste;
    if (!/^teste\.[a-z0-9]+$/.test(quem) || !senha) { res.statusCode = 404; res.end(JSON.stringify({ erro: "conta desconhecida" })); return; }
    const r = await fetch(`${api}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: quem, password: senha }) });
    const corpo = await r.text();
    res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(corpo);
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erro: String(e.message ?? e).slice(0, 120) })); }
}).listen(3998, "127.0.0.1");
