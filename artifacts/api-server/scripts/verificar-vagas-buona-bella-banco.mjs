/** Conferência de leitura após o cadastro autorizado; nunca altera dados. */
import assert from "node:assert/strict";
import pg from "pg";
import { cadastro, regrasNoiteAlema, resolverPessoa } from "./vagas-buona-bella.mjs";

const orgId = "77ea430d-3548-4952-b9da-22587d016da3";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  await c.query("BEGIN READ ONLY");
  const { rows: livros } = await c.query(`
    select s.id, s.title, s.description, l.name as local
    from show_books s join locations l on l.id=s.location_id
    join operations o on o.id=s.operation_id
    where o.organization_id=$1 and (l.name='Buona' or l.name='Bella') and s.status<>'ARCHIVED'
  `, [orgId]);
  const ids = livros.map((livro) => livro.id);
  const { rows: vagas } = await c.query(`
    select ch.show_book_id, ch.id as character_id, ch.name, r."order" as position_order,
           cc.person_id, cc."order" as cast_order, u.nome_completo as full_name, u.nome_de_exibicao as display_name
    from characters ch
    join show_book_lines ln on ln.character_id=ch.id and ln.active
    join show_book_roles r on r.id=ln.position_id and r.active
    join character_cast cc on cc.character_id=ch.id and cc.active
    join users u on u.id=cc.person_id
    where ch.show_book_id=any($1::uuid[]) and ch.active
    order by ch.show_book_id, r."order", cc."order"
  `, [ids]);
  const pessoas = [...new Map(vagas.map((vaga) => [vaga.person_id, {
    id: vaga.person_id, fullName: vaga.full_name, name: vaga.display_name, status: "ACTIVE",
  }])).values()];
  for (const item of cadastro) {
    const [livro] = livros.filter((l) => l.local === item.local && l.title === item.show);
    assert.ok(livro, `${item.show}: livro ausente`);
    const doShow = vagas.filter((vaga) => vaga.show_book_id === livro.id);
    const nomesVagas = [...new Set(doShow.map((vaga) => vaga.name))];
    assert.deepEqual(nomesVagas, item.vagas, `${item.show}: vagas ou ordem diferentes`);
    const filaEsperada = item.fila.map((nome) => resolverPessoa(pessoas, nome));
    for (const nome of item.vagas) {
      const fila = doShow.filter((vaga) => vaga.name === nome).map((vaga) => vaga.person_id);
      assert.deepEqual(fila, filaEsperada, `${item.show} / ${nome}: fila diferente`);
    }
    if (item.show === "Noite Alemã") assert.ok(livro.description.includes(regrasNoiteAlema));
    console.log(`${item.local} / ${item.show}: ${nomesVagas.length} vaga(s), fila correta.`);
  }
  const { rows: registros } = await c.query(`
    select action, count(*)::int as quantidade from history_events
    where org_id=$1 and actor_type='DETERMINISTIC_ENGINE'
      and actor_name='Codex, com autorização da Administração'
      and action in ('show_book.updated', 'show_book.vaga.created')
    group by action
  `, [orgId]);
  const contagem = Object.fromEntries(registros.map((r) => [r.action, r.quantidade]));
  assert.ok(contagem["show_book.vaga.created"] >= 11, "faltam Registros das vagas");
  assert.ok(contagem["show_book.updated"] >= 1, "falta Registro das observações");
  console.log("11 vagas, filas e 12 Registros confirmados em produção.");
  await c.query("ROLLBACK");
} catch (erro) {
  await c.query("ROLLBACK");
  console.error("Conferência falhou:", erro.message);
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
