import { useEffect, useState } from "react";
import { Link } from "wouter";
import { css } from "@/lib/dc-style";
import type { Bloco, Dia } from "@/pages/escalas";
import { faixa, textoDoBloco } from "./tipos";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const botao = (tipo: "primario" | "fantasma") => "border-radius:999px;padding:9px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif;min-height:44px;" + (tipo === "primario" ? "border:none;background:linear-gradient(135deg,var(--asa-purple),var(--asa-aula-fg));color:#fff;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-ink-medium);");
const hhmm = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export type ConflitoDaPessoa = { pessoa: string; pessoaId: string; areaId: string | null; a: Bloco; b: Bloco };
export type GrupoDeConflito = { a: Bloco; b: Bloco; pessoas: ConflitoDaPessoa[] };

export type AtencaoDoDiaProps = {
  dia: Dia;
  vazios: Bloco[];
  grupos: GrupoDeConflito[];
  canEdit: boolean;
  editableAreaIds: string[] | null;
  tirando: string;
  onTirar: (bloco: Bloco, pessoaId: string) => Promise<void>;
  onMudarHorario: (pessoaId: string, nome: string, bloco: Bloco, outro: Bloco) => void;
  onVoltarHorario: (bloco: Bloco, pessoaId: string) => void;
  onAjustarVazio: (bloco: Bloco) => void;
  onFolgaResolvida?: (pessoaId: string) => Promise<void>;
  /** Quem pode mexer: "Desfazer" ao lado de cada mudança de local só de hoje. */
  onDesfazerImprevisto?: (imprevistoId: string) => void;
  /** Quem pode mexer: "Trazer para cá hoje" ao lado de quem está sem local hoje. */
  onTrazer?: (pessoaId: string) => void;
};

/** Tudo o que pede olhar no dia, em um cartão só: some quando não há nada. */
export function AtencaoDoDia({ dia, vazios, grupos, canEdit, editableAreaIds, tirando, onTirar, onMudarHorario, onVoltarHorario, onAjustarVazio, onFolgaResolvida, onDesfazerImprevisto, onTrazer }: AtencaoDoDiaProps) {
  const chamadas = dia.pessoas.filter((p) => p.chamadaNaFolga && !p.chamadaNaFolga.decidida);
  const alterada = dia.escala?.alteradaDesde ?? null;
  const semProgramacao = !dia.programacao;
  const mexidas = dia.mexidas ?? [];
  const nomeDe = new Map(dia.pessoas.map((p) => [p.id, p.name]));
  const choques = dia.choquesEntreLocais ?? [];
  const semLocal = (dia.semLocalHoje ?? []).filter((id) => nomeDe.has(id));
  const imprevistos = (dia.imprevistos ?? []).filter((i) => nomeDe.has(i.pessoaId));
  const total = (imprevistos.length ? 1 : 0) + (choques.length ? 1 : 0) + (semLocal.length ? 1 : 0) + (mexidas.length ? 1 : 0) + (vazios.length ? 1 : 0) + grupos.length + chamadas.length + (alterada ? 1 : 0) + (semProgramacao ? 1 : 0);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { const abrir = () => setAberto(true); window.addEventListener("ge-abrir-atencao", abrir); return () => window.removeEventListener("ge-abrir-atencao", abrir); }, []);
  if (!total) return null;
  const resumo = [
    vazios.length ? plural(vazios.length, "bloco com lugar sem ninguém", "blocos com lugar sem ninguém") : "",
    grupos.length ? plural(new Set(grupos.flatMap((g) => g.pessoas.map((c) => c.pessoaId))).size, "pessoa em dois lugares", "pessoas em dois lugares") : "",
    imprevistos.length ? plural(imprevistos.length, "mudança de local só de hoje", "mudanças de local só de hoje") : "",
    choques.length ? plural(new Set(choques.map((c) => c.pessoaId)).size, "pessoa que não cabe em dois locais", "pessoas que não cabem em dois locais") : "",
    semLocal.length ? plural(semLocal.length, "pessoa sem local hoje", "pessoas sem local hoje") : "",
    chamadas.length ? plural(chamadas.length, "chamada na folga", "chamadas na folga") : "",
    mexidas.length ? plural(mexidas.length, "mexida de outra área", "mexidas de outras áreas") : "",
    alterada ? "mudou depois de publicada" : "",
    semProgramacao ? "sem Programação" : "",
  ].filter(Boolean).join(" · ");

  return <details id="atencao-do-dia" className="ge-aten" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
    <summary className="ge-aten-topo" style={{ cursor: "pointer", listStyle: "none", minHeight: 44 }}>
      <img src="/asa/aviso-importante.webp" alt="" style={css("width:28px;height:28px;object-fit:contain;flex:none")}/>
      <h2>Atenção do dia</h2>
      <span className="ge-aten-n" aria-label={plural(total, "coisa para ver", "coisas para ver")}>{total}</span>
      <span style={css("flex:1;min-width:0;font-size:12.5px;line-height:1.35;color:var(--asa-amber-dark);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical")}>{resumo}</span>
      <span style={css("flex:none;font-size:12px;font-weight:700;color:var(--asa-amber-mid)")}>{aberto ? "fechar" : "ver"}</span>
    </summary>

    {imprevistos.length > 0 && <div style={css("display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:14px;padding:11px 13px;")}>
      <div style={css("display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-ink-dark)")}>Mudanças de local só de hoje</span>
        <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45")}>Valem só nesta data e não mexem na Programação. Dá para desfazer.</span>
      </div>
      <ul style={css("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px")}>
        {imprevistos.map((i) => <li key={i.id} style={css("display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12.5px;line-height:1.5;color:var(--asa-ink-medium);border:1px solid var(--asa-line-soft);background:var(--asa-lavender-chalk, #faf8fe);border-radius:12px;padding:6px 11px")}>
          <span style={css("flex:1 1 220px;min-width:0")}><strong style={css("color:var(--asa-ink-dark)")}>{nomeDe.get(i.pessoaId)}</strong>{` trabalha em ${i.localNome}${i.inicio && i.fim ? ` das ${i.inicio} às ${i.fim}` : i.inicio ? ` a partir das ${i.inicio}` : i.fim ? ` até as ${i.fim}` : " o dia inteiro"}`}{i.motivo ? ` · ${i.motivo}` : ""}{i.porNome ? ` · por ${i.porNome}` : ""}</span>
          {canEdit && onDesfazerImprevisto && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} aria-label={`Desfazer a mudança de local de ${nomeDe.get(i.pessoaId)}`} onClick={() => onDesfazerImprevisto(i.id)}>Desfazer</button>}
        </li>)}
      </ul>
    </div>}

    {choques.length > 0 && <div style={css("display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--asa-rose-surface);border-radius:14px;padding:11px 13px;")}>
      <div style={css("display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-rose-fg)")}>Pessoa que não cabe em dois locais</span>
        <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45")}>A mesma pessoa está em duas coisas em locais diferentes. É um alerta: não bloqueia a publicação, e pode ser de propósito. O tempo de ida entre os locais é escrito pela Administração em Cadastros, Locais.</span>
      </div>
      <ul style={css("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px")}>
        {choques.map((c) => <li key={`${c.pessoaId}-${c.aqui.key}-${c.la.key}`} style={css("font-size:12.5px;line-height:1.5;color:var(--asa-ink-medium);border:1px solid var(--asa-rose-faint);background:var(--asa-rose-paper);border-radius:12px;padding:8px 11px")}>
          <strong style={css("color:var(--asa-ink-dark)")}>{nomeDe.get(c.pessoaId) ?? "Pessoa"}</strong>{` está em ${c.aqui.rotulo} (${c.aqui.inicio}${c.aqui.fim ? `–${c.aqui.fim}` : ""}) aqui e em ${c.la.rotulo} (${c.la.inicio}${c.la.fim ? `–${c.la.fim}` : ""}) em ${c.la.localNome}. `}
          {c.tipo === "mesmo_horario" ? "Os horários se cruzam." : `A ida leva ${c.minutosDeIda} min e a folga entre uma e outra é de ${c.minutosDeFolga} min.`}
        </li>)}
      </ul>
    </div>}

    {semLocal.length > 0 && <div style={css("display:flex;flex-direction:column;gap:6px;background:var(--asa-amber-pale);border:1px solid var(--asa-amber-stripe);border-radius:12px;padding:10px 13px;")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-amber-dark)")}>Sem local hoje</span>
      <span style={css("font-size:12.5px;line-height:1.5;color:var(--asa-amber-dark);text-wrap:pretty")}>{`${semLocal.length === 1 ? "Esta pessoa tem equipe marcada nesta temporada, mas não neste dia da semana" : "Estas pessoas têm equipe marcada nesta temporada, mas não neste dia da semana"}. Por isso não entram nos blocos de todo mundo nem de área de nenhum local. Pode entrar em show, se estiver livre, e por um imprevisto do dia.`}</span>
      <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
        {semLocal.map((id) => <span key={id} style={css("display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;border:1px solid var(--asa-amber-stripe);background:#fff;border-radius:16px;padding:3px 4px 3px 10px;font-size:12px;font-weight:700;color:var(--asa-ink-dark)")}>
          {nomeDe.get(id)}
          {canEdit && onTrazer && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} aria-label={`Trazer ${nomeDe.get(id)} para cá hoje`} onClick={() => onTrazer(id)}>Trazer para cá hoje</button>}
        </span>)}
      </div>
    </div>}

    {mexidas.length > 0 && <div style={css("display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:12px;padding:10px 13px;")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-ink-dark)")}>Mexeram em pessoas de outra área</span>
      <ul style={css("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px")}>
        {mexidas.map((m, i) => <li key={`${m.pessoaId}-${m.em}-${i}`} style={css("font-size:12.5px;line-height:1.45;color:var(--asa-ink-medium)")}>
          <strong style={css("color:var(--asa-ink-dark)")}>{m.porNome}</strong>{m.porAreaNome ? ` (${m.porAreaNome})` : ""} {m.texto} · {m.pessoaNome}{m.pessoaAreaNome ? ` (${m.pessoaAreaNome})` : ""} · {hhmm(m.em)}
        </li>)}
      </ul>
      <span style={css("font-size:12px;color:var(--asa-label)")}>A Supervisão da área da pessoa vê quem mexeu. Não precisa de motivo.</span>
    </div>}

    {vazios.length > 0 && <details className="esc-vazios" style={css("background:var(--asa-late-bg);border:1px solid var(--asa-amber-streak);border-radius:12px;padding:6px 12px;")}>
      <summary style={css("display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;min-height:44px")}>
        <span style={css("font-size:12.5px;font-weight:700;color:var(--asa-amber-mid);flex:1")}>{plural(vazios.length, "bloco com lugar sem ninguém", "blocos com lugar sem ninguém")}</span>
        <span className="esc-vazios-ver" style={css("font-size:12px;font-weight:700;color:var(--asa-amber-mid)")}>ver quais</span>
      </summary>
      <ul style={css("margin:6px 0 6px;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px")}>
        {vazios.map((b) => <li key={b.key} style={css("display:flex;align-items:center;gap:10px;font-size:12px;color:var(--asa-amber-brown);flex-wrap:wrap")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-weight:700;width:96px;flex:none")}>{faixa(b)}</span>
          <span style={css("flex:1;min-width:120px")}>{textoDoBloco(b)}</span>
          {canEdit && b.regra !== "ninguem" && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => onAjustarVazio(b)}>Ajustar</button>}
        </li>)}
      </ul>
    </details>}

    {grupos.length > 0 && <div style={css("display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid var(--asa-rose-surface);border-radius:14px;padding:11px 13px;")}>
      <div style={css("display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600;color:var(--asa-rose-fg)")}>Mesma pessoa em dois lugares</span>
        <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45")}>{`${plural(new Set(grupos.flatMap((g) => g.pessoas.map((c) => c.pessoaId))).size, "pessoa", "pessoas")} em duas coisas ao mesmo tempo. Quem responde pela atividade escolhe de qual a pessoa sai. É um alerta: não bloqueia a publicação.`}</span>
      </div>
      {grupos.map((g) => {
        const ini = g.a.inicio > g.b.inicio ? g.a.inicio : g.b.inicio;
        const fim = [g.a.fim ?? g.a.inicio, g.b.fim ?? g.b.inicio].sort()[0];
        const tiraveis = [g.a, g.b].filter((bloco) => !bloco.chamada && bloco.regra !== "livro" && !bloco.horarioDela);
        const mudaveis = [g.a, g.b].filter((bloco) => !bloco.chamada && bloco.regra !== "livro" && bloco.origem !== "livro" && bloco.origem !== "solicitacao");
        return <div key={`${g.a.key}-${g.b.key}`} style={css("display:flex;flex-direction:column;gap:8px;border:1px solid var(--asa-rose-faint);background:var(--asa-rose-paper);border-radius:12px;padding:10px 12px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px")}>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--asa-rose-fg)")}>{fim > ini ? `${ini}–${fim}` : ini}</span>
            <span style={css("font-size:13px;font-weight:700;color:var(--asa-ink-dark)")}>{`${textoDoBloco(g.a)}  ×  ${textoDoBloco(g.b)}`}</span>
            <span style={css("font-size:12px;color:var(--asa-label)")}>{plural(g.pessoas.length, "pessoa", "pessoas")}</span>
          </div>
          {(g.a.chamada || g.b.chamada) && <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45;text-wrap:pretty")}>A chamada ocupa o tempo de quem a recebe e acompanha a atividade dela. Para resolver, mude a outra atividade ou a hora da chamada (no show, na Programação ou na atividade do dia).</span>}
          {(g.a.regra === "livro" || g.b.regra === "livro") && <span style={css("font-size:12px;color:var(--asa-label);line-height:1.45;text-wrap:pretty")}>O show tem prioridade, mas não decide sozinho. Tirar do show é no Livro do Dia.</span>}
          <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
            {g.pessoas.map((c) => {
              const pode = canEdit && (editableAreaIds === null || (c.areaId !== null && editableAreaIds.includes(c.areaId)));
              return <span key={c.pessoaId} style={css("display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;border:1px solid var(--asa-rose-muted);background:#fff;border-radius:16px;padding:3px 4px 3px 10px;font-size:12px;font-weight:700;color:var(--asa-ink-dark)")}>
                {c.pessoa}
                {pode && tiraveis.map((bloco) => <button key={bloco.key} type="button" className="esc-cell-adjust esc-hit" aria-label={`Tirar ${c.pessoa} de ${textoDoBloco(bloco)}`} disabled={tirando === `${c.pessoaId}|${bloco.key}`} onClick={() => void onTirar(bloco, c.pessoaId)}>
                  {tirando === `${c.pessoaId}|${bloco.key}` ? "Tirando…" : `Tirar de ${textoDoBloco(bloco)}`}
                </button>)}
                {pode && mudaveis.map((bloco) => <button key={`h-${bloco.key}`} type="button" className="esc-cell-adjust esc-hit" aria-label={`Mudar o horário de ${textoDoBloco(bloco)} só para ${c.pessoa}`} onClick={() => onMudarHorario(c.pessoaId, c.pessoa, bloco, bloco === g.a ? g.b : g.a)}>{`Mudar horário de ${textoDoBloco(bloco)}`}</button>)}
                {pode && [g.a, g.b].filter((bloco) => bloco.horarioDela).map((bloco) => <button key={`v-${bloco.key}`} type="button" className="esc-cell-adjust esc-hit" aria-label={`Voltar ${c.pessoa} ao horário normal de ${textoDoBloco(bloco)}`} onClick={() => onVoltarHorario(bloco, c.pessoaId)}>{`Voltar ao horário normal de ${textoDoBloco(bloco)}`}</button>)}
                {!pode && <span style={css("font-size:12px;font-weight:500;color:var(--asa-label);padding-right:8px")}>{canEdit ? "de outra área: só a Supervisão dela ou a Administração ajusta" : "somente leitura"}</span>}
              </span>;
            })}
          </div>
        </div>;
      })}
    </div>}

    {chamadas.map((p) => <div key={`folga-${p.id}`} style={css("display:flex;flex-wrap:wrap;align-items:center;gap:11px;background:var(--asa-late-bg);border:1px solid var(--asa-amber-stripe);border-radius:12px;padding:10px 13px;")}>
      <span style={css("font-size:12px;color:var(--asa-amber-dark);line-height:1.5;flex:1;min-width:220px;text-wrap:pretty")}>{`${p.name} está de folga neste dia e entrou na escala mesmo assim${p.chamadaNaFolga?.motivo ? ` — ${p.chamadaNaFolga.motivo}` : ""}. Falta decidir a folga: remarcar para outro dia ou deixar como está.`}</span>
      <Link href="/folgas" className="esc-hit" style={css(botao("fantasma") + "text-decoration:none;display:inline-flex;align-items:center")}>Abrir Folgas</Link>
      {canEdit && onFolgaResolvida && <button type="button" className="esc-hit" onClick={() => void onFolgaResolvida(p.id)} style={css(botao("primario"))}>Já resolvi</button>}
    </div>)}

    {alterada && <div style={css("background:var(--asa-amber-pale);border:1px solid var(--asa-amber-stripe);border-radius:12px;padding:10px 13px;")}>
      <span style={css("font-size:12px;color:var(--asa-amber-dark);line-height:1.5;text-wrap:pretty")}>{`Esta escala mudou depois de publicada (${hhmm(alterada)}): pode ter sido uma troca, o Livro do Dia ou uma atividade nova. Aqui você já vê como está; quem faz continua com a versão publicada até a Administração republicar.`}</span>
    </div>}

    {semProgramacao && <div style={css("font-size:12.5px;color:var(--asa-label);background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px;padding:10px 13px")}>{`${dia.location.name} não tem Programação vigente para este dia: a grade mostra só os Livros do Dia e as entradas manuais.`}</div>}
  </details>;
}
