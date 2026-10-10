/**
 * Empresa de teste para andar pelas telas sem tocar em dado real.
 *
 *   node scripts/empresa-de-teste.cjs criar    → monta tudo e grava as credenciais
 *   node scripts/empresa-de-teste.cjs apagar   → remove tudo o que ela criou
 *
 * Só funciona contra o banco de TESTE: lê o `.env.test` da raiz e recusa se a URL não for a do
 * projeto apontado por MYASA_TEST_DATABASE_REF. Nunca lê `.env.producao`.
 *
 * As senhas são sorteadas a cada execução e vão para `empresa-de-teste.local.json`, ao lado deste
 * arquivo, que o Git ignora (`*.local.json`). Não escreva senha de teste em commit, em documento do
 * repositório nem na conversa com o assistente: o hábito é o que protege as senhas de verdade.
 *
 * Precisa da API rodando em http://localhost:3001 (é por ela que as telas criam as coisas, e assim
 * o roteiro exercita as mesmas regras que a tela exercita).
 */
const path = require("path");
const fs = require("fs");

const raiz = path.resolve(__dirname, "../../..");
const req = (nome) => require(require.resolve(nome, { paths: [raiz, __dirname] }));
const { Pool } = req("pg");
const bcrypt = req("bcryptjs");

const envPath = path.join(raiz, ".env.test");
if (!fs.existsSync(envPath)) { console.error("RECUSA: não encontrei .env.test na raiz do projeto."); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  .filter((linha) => /^\s*[A-Za-z_]\w*=/.test(linha))
  .map((linha) => { const i = linha.indexOf("="); return [linha.slice(0, i).trim(), linha.slice(i + 1).trim()]; }));
const ref = (env.MYASA_TEST_DATABASE_REF ?? "").trim().toLowerCase();
if (!ref || !(env.DATABASE_URL ?? "").toLowerCase().includes(ref)) {
  console.error("RECUSA: o DATABASE_URL do .env.test não é o banco identificado por MYASA_TEST_DATABASE_REF.");
  process.exit(1);
}

const API = process.env.MYASA_API_URL ?? "http://localhost:3001/api";
const arquivoLocal = path.join(__dirname, "empresa-de-teste.local.json");
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const senha = () => `t-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`;

async function api(token, metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → ${r.status} ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : {};
}

async function criar() {
  const marca = `teste${Date.now().toString(36)}`;
  const c = await pool.connect();
  let org, op, adminLogin, adminSenha;
  try {
    await c.query("BEGIN");
    const q = async (sql, params) => (await c.query(sql, params)).rows[0];
    org = await q(`insert into organizations (name) values ($1) returning id`, [`ASA Teste (${marca})`]);
    op = await q(`insert into operations (organization_id, name, status) values ($1, 'Operação Teste', 'ACTIVE') returning id`, [org.id]);
    adminLogin = `${marca}.admin`; adminSenha = senha();
    const admin = await q(
      `insert into users (organization_id, nome_de_exibicao, nome_completo, username, password_hash) values ($1, 'Admin Teste', 'Administração Teste', $2, $3) returning id`,
      [org.id, adminLogin, await bcrypt.hash(adminSenha, 10)]);
    await q(`insert into user_roles (user_id, operation_id, role, active) values ($1, $2, 'ADMIN', true) returning id`, [admin.id, op.id]);
    // Turnos do check-in valendo já hoje. Pela tela, a configuração só vale a partir de amanhã —
    // aqui vai direto no banco para o roteiro poder exercitar o check-in no mesmo dia.
    for (const [nome, inicio, fim] of [["Dia", "07:00", "18:00"], ["Noite", "18:00", "23:59"]]) {
      await q(`insert into shifts (organization_id, name, start_time, end_time, effective_from) values ($1, $2, $3, $4, $5) returning id`, [org.id, nome, inicio, fim, hoje]);
    }
    await c.query("COMMIT");
  } catch (erro) { await c.query("ROLLBACK"); throw erro; } finally { c.release(); }

  const estado = { marca, orgId: org.id, opId: op.id, hoje, pessoas: { admin: { login: adminLogin, senha: adminSenha } } };
  const guardar = () => fs.writeFileSync(arquivoLocal, JSON.stringify(estado, null, 2));
  guardar();

  const entrar = async (usuario, chave) => (await api(null, "POST", "/auth/login", { username: usuario, password: chave })).accessToken;
  const t = await entrar(adminLogin, adminSenha);
  const snow = (await api(t, "POST", "/locations", { name: "Snow Teste", openTime: "08:00", closeTime: "23:59" })).location;
  const acqua = (await api(t, "POST", "/locations", { name: "Acqua Teste", openTime: "08:00", closeTime: "23:59" })).location;
  const pat = (await api(t, "POST", "/areas", { name: "Patinadores" })).area;
  const bai = (await api(t, "POST", "/areas", { name: "Bailarinos" })).area;

  const pessoa = async (chave, nome, perfil, areaId) => {
    const s = senha();
    const r = await api(t, "POST", "/users", { fullName: `${nome} Teste`, nomeDeUso: nome, login: `${marca}.${chave}`, password: s, perfil, areaId });
    const id = (r.user ?? r).id;
    estado.pessoas[chave] = { id, login: `${marca}.${chave}`, senha: s, nome, perfil };
    return id;
  };
  await pessoa("direcao", "Direção", "DIR", undefined);
  const supPat = await pessoa("sup.patinadores", "Sup Patinadores", "SUP", pat.id);
  const supBai = await pessoa("sup.bailarinos", "Sup Bailarinos", "SUP", bai.id);
  const elenco = [];
  for (const [chave, nome, area] of [
    ["p1", "Pessoa 1", pat], ["p2", "Pessoa 2", pat], ["p3", "Pessoa 3", pat], ["p4", "Pessoa 4", pat],
    ["b1", "Pessoa 5", bai], ["b2", "Pessoa 6", bai], ["b3", "Pessoa 7", bai], ["b4", "Pessoa 8", bai],
  ]) elenco.push(await pessoa(chave, nome, "MEM", area.id));
  guardar();

  await api(t, "PUT", `/areas/${pat.id}/locations/${snow.id}/supervisor`, { supervisorId: supPat });
  await api(t, "PUT", `/areas/${bai.id}/locations/${snow.id}/supervisor`, { supervisorId: supBai });

  const show = async (titulo) => (await api(t, "POST", "/show-books", { title: titulo, locationId: snow.id, type: "CHARACTERS_ONLY" })).showBook;
  const boasVindas = await show("Boas Vindas Teste");
  const musical = await show("Musical Teste");
  await api(t, "PATCH", `/show-books/${musical.id}/responsible`, { responsibleId: supBai, reason: "Empresa de teste" });
  await api(t, "POST", `/show-books/${boasVindas.id}/sessions`, { startTime: "22:30", endTime: "22:40", callTime: "22:15" });
  await api(t, "POST", `/show-books/${musical.id}/sessions`, { startTime: "23:00", endTime: "23:30", callTime: "22:45" });

  const [p1, p2, p3, p4, b1, b2, b3] = elenco;
  // Um personagem compartilhado (titular, com fila) e vagas de rodízio: é o que faz o Livro do Dia
  // escolher sozinho quem entra, e o que a Escala mostra por pessoa.
  const personagem = (await api(t, "POST", "/characters", { name: "Personagem Teste", locationId: snow.id, mode: "titular" })).character;
  for (const [ordem, quem] of [p2, b1].entries()) await api(t, "POST", `/characters/${personagem.id}/cast`, { personId: quem, order: ordem, timesDone: 0 });
  await api(t, "POST", `/show-books/${boasVindas.id}/vagas`, { name: "Boas vindas 1", mode: "rodizio", memberIds: [p1, p3, p4, b2, b3] });
  await api(t, "POST", `/show-books/${boasVindas.id}/vagas`, { name: "Boas vindas 2", mode: "rodizio", memberIds: [p1, p3, p4, b2, b3] });
  await api(t, "POST", `/show-books/${musical.id}/vagas`, { characterId: personagem.id });
  await api(t, "POST", `/show-books/${musical.id}/vagas`, { name: "Vaga 2", mode: "rodizio", memberIds: [b1, b2, p3] });
  await api(t, "POST", `/show-books/${musical.id}/vagas`, { name: "Vaga 3", mode: "rodizio", memberIds: [p4, b3, p1] });
  for (const s of [boasVindas, musical]) {
    await api(t, "PATCH", `/show-books/${s.id}/status`, { status: "PUBLISHED", reason: "Empresa de teste" })
      .catch((erro) => console.log("publicar show:", erro.message));
  }

  const prog = (await api(t, "POST", "/programacoes", { locationId: snow.id, nome: "Programação Teste", vigenciaInicio: hoje, vigenciaFim: `${hoje.slice(0, 4)}-12-31` })).programacao;
  await api(t, "POST", `/programacoes/${prog.id}/blocos`, { weekdays: [0, 1, 2, 3, 4, 5, 6], inicio: "22:30", fim: "22:40", rotulo: "Boas Vindas", regra: "livro", showBookId: boasVindas.id });
  await api(t, "POST", `/programacoes/${prog.id}/blocos`, { weekdays: [0, 1, 2, 3, 4, 5, 6], inicio: "23:00", fim: "23:30", rotulo: "Musical", regra: "livro", showBookId: musical.id });
  // Uma pessoa de folga hoje: o Livro do Dia tem de pular ela, e a Escala tem de mostrar a folga.
  await api(t, "POST", "/folgas/grid/toggle", { userId: p4, operationId: op.id, date: hoje, type: "NO_SHOW" });

  Object.assign(estado, {
    snowId: snow.id, acquaId: acqua.id, patId: pat.id, baiId: bai.id,
    showIds: [boasVindas.id, musical.id], personagemId: personagem.id, programacaoId: prog.id,
  });
  guardar();
  console.log(`empresa de teste criada (${marca}); credenciais em ${path.basename(arquivoLocal)} — não copie as senhas para lugar nenhum`);
}

async function apagar() {
  if (!fs.existsSync(arquivoLocal)) { console.error(`RECUSA: não encontrei ${path.basename(arquivoLocal)}; sem ele não sei o que apagar.`); process.exit(1); }
  const { orgId } = JSON.parse(fs.readFileSync(arquivoLocal, "utf8"));
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const ids = async (sql) => (await c.query(sql, [orgId])).rows.map((r) => r.id);
    const pessoas = await ids(`select id from users where organization_id = $1`);
    const ops = await ids(`select id from operations where organization_id = $1`);
    const shows = (await c.query(`select id from show_books where operation_id = any($1::uuid[])`, [ops])).rows.map((r) => r.id);
    const rodar = (sql, p) => c.query(sql, p);
    // As duas árvores — Livro do Show e Livro do Dia — saem de baixo para cima e à mão: a varredura
    // genérica abaixo só alcança quem aponta direto para show_books, e a linha de uma vaga aponta
    // para a vaga, não para o show.
    if (shows.length) {
      await rodar(`delete from show_book_lines where position_id in (
        select r.id from show_book_roles r where r.show_book_id = any($1::uuid[]))`, [shows]);
      await rodar(`delete from show_book_position_library_refs where position_id in (
        select r.id from show_book_roles r where r.show_book_id = any($1::uuid[]))`, [shows]).catch(() => {});
      await rodar(`delete from show_book_roles where show_book_id = any($1::uuid[])`, [shows]);
      await rodar(`delete from show_book_keyframes where scene_id in (
        select s.id from show_book_scenes s where s.show_book_id = any($1::uuid[]))`, [shows]).catch(() => {});
      await rodar(`delete from show_book_blocks where show_book_id = any($1::uuid[])`, [shows]);
      await rodar(`delete from show_book_scenes where show_book_id = any($1::uuid[])`, [shows]);
      const livros = (await c.query(`select id from daily_books where show_book_id = any($1::uuid[])`, [shows])).rows.map((r) => r.id);
      if (livros.length) {
        await rodar(`delete from daily_book_assignments where daily_book_id = any($1::uuid[])`, [livros]);
        await rodar(`delete from daily_book_positions where daily_book_id = any($1::uuid[])`, [livros]);
        await rodar(`delete from daily_book_blocks where daily_book_id = any($1::uuid[])`, [livros]);
        await rodar(`delete from daily_book_scenes where daily_book_id = any($1::uuid[])`, [livros]);
      }
    }
    // Apaga em camadas, do mais dependente para o menos: qualquer tabela que aponte para pessoas,
    // shows, locais, áreas ou a operação. Varre as chaves estrangeiras em vez de manter uma lista
    // à mão, que envelhece a cada tabela nova.
    const fk = await c.query(`select conrelid::regclass::text as tabela, a.attname as coluna, confrelid::regclass::text as alvo
      from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
      where k.contype = 'f' and confrelid::regclass::text in ('users','operations','organizations','show_books','locations','areas')`);
    const alvos = { users: pessoas, operations: ops, organizations: [orgId], show_books: shows };
    for (let rodada = 0; rodada < 6; rodada++) {
      for (const linha of fk.rows) {
        const lista = alvos[linha.alvo]
          ?? (linha.alvo === "locations" ? await ids(`select id from locations where organization_id = $1`)
            : linha.alvo === "areas" ? await ids(`select id from areas where organization_id = $1`) : []);
        if (!lista.length || ["users", "operations", "organizations", "show_books", "locations", "areas"].includes(linha.tabela)) continue;
        await rodar(`savepoint s`);
        try { await rodar(`delete from ${linha.tabela} where ${linha.coluna} = any($1::uuid[])`, [lista]); await rodar(`release savepoint s`); }
        catch { await rodar(`rollback to savepoint s`); }
      }
    }
    await rodar(`delete from show_books where id = any($1::uuid[])`, [shows]);
    await rodar(`delete from users where id = any($1::uuid[])`, [pessoas]);
    await rodar(`delete from areas where organization_id = $1`, [orgId]);
    await rodar(`delete from locations where organization_id = $1`, [orgId]);
    await rodar(`delete from operations where organization_id = $1`, [orgId]);
    await rodar(`delete from organizations where id = $1`, [orgId]);
    await c.query("COMMIT");
    fs.unlinkSync(arquivoLocal);
    console.log("empresa de teste apagada");
  } catch (erro) { await c.query("ROLLBACK"); throw erro; } finally { c.release(); }
}

(process.argv[2] === "apagar" ? apagar() : criar())
  .catch((erro) => { console.error(erro.message); process.exitCode = 1; })
  .finally(() => pool.end());
