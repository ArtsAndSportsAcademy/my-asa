/**
 * 28 Perfil e configurações — só o que a própria pessoa decide sobre si.
 * Cadastro (nome completo, vínculo, área, perfil de acesso) mora em Pessoas.
 * Visual copiado de design_handoff_my_asa/telas/28 Perfil e configurações.dc.html.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { css } from "@/lib/dc-style";
import { semRede } from "@/lib/sem-rede";
import "./perfil.css";

type ShellRole = "adm" | "dir" | "sup" | "mem";
type Me = { id: string; name?: string; displayName?: string; username?: string | null; email?: string | null; phone?: string | null; contactVisibility?: { email: boolean; phone: boolean } };

const ROLE_NAME: Record<ShellRole, string> = { adm: "Administração", dir: "Direção", sup: "Supervisão", mem: "Elenco" };
const CARD = "background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:15px 18px;display:flex;flex-direction:column;gap:12px";
const H2 = "font-family:Outfit,sans-serif;font-size:16px;font-weight:600";
const NOTE = "font-size:11.5px;color:#6b6482";
const MONO = "font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482";
const LINK = "font-size:12px;font-weight:700;color:#6C2BF2;cursor:pointer;background:none;border:0;padding:0;font-family:inherit";
const INPUT = "font:inherit;font-size:13px;font-weight:600;padding:10px 12px;border:1px solid #e6e1f2;border-radius:11px;background:#faf9fe;color:#1c1440;min-height:44px;width:100%;box-sizing:border-box";
const PRIMARY = "cursor:pointer;font-family:Manrope,sans-serif;font-size:12.5px;font-weight:700;color:#fff;background:#6C2BF2;border:0;border-radius:999px;padding:10px 18px;min-height:44px";
const optionStyle = (on: boolean) => "cursor:pointer;font-family:Manrope,sans-serif;font-size:12px;font-weight:700;border-radius:999px;padding:8px 14px;min-height:40px;" + (on ? "background:#6C2BF2;color:#fff;border:1px solid #6C2BF2" : "background:#fff;color:#5b5473;border:1px solid #e6e1f2");

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?"; }
function erroDe(err: unknown, fallback: string) {
  if (semRede(err)) return "Sem conexão. Tente de novo quando a internet voltar.";
  if (err instanceof ApiError) {
    const data = err.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}

export { useSignOut } from "@/hooks/use-sign-out";
import { useSignOut } from "@/hooks/use-sign-out";

function MudarSenha({ onDone }: { onDone: (msg: string) => void }) {
  const [atual, setAtual] = useState(""), [nova, setNova] = useState(""), [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  const enviar = async (event: React.FormEvent) => {
    event.preventDefault(); setErro("");
    if (nova.length < 6) { setErro("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (nova !== confirma) { setErro("A confirmação não bate com a nova senha."); return; }
    if (nova === atual) { setErro("A nova senha precisa ser diferente da atual."); return; }
    setSalvando(true);
    try {
      const r = await customFetch<{ sessoesEncerradas: number }>("/api/users/me/password", { method: "POST", body: JSON.stringify({ currentPassword: atual, newPassword: nova, refreshToken: localStorage.getItem("myasa_refresh_token") }) });
      onDone(`Senha trocada.${r.sessoesEncerradas ? ` ${r.sessoesEncerradas === 1 ? "A sessão em outro aparelho foi encerrada." : `${r.sessoesEncerradas} sessões em outros aparelhos foram encerradas.`}` : ""}`);
    } catch (err) {
      setErro(err instanceof ApiError && err.status === 401 ? "A senha atual não confere." : erroDe(err, "Não consegui trocar a senha agora. Tente de novo."));
    } finally { setSalvando(false); }
  };
  return <form onSubmit={enviar} style={css(CARD)} aria-label="Mudar senha">
    <div style={css("display:flex;align-items:baseline;gap:10px;flex-wrap:wrap")}><span style={css(H2)}>Mudar senha</span><span style={css("flex:1")}/><span style={css(NOTE)}>os outros aparelhos saem da conta; este continua</span></div>
    <div className="pf-fields">
      <label style={css("display:flex;flex-direction:column;gap:5px")}><span style={css(MONO)}>Senha atual</span><input aria-label="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} style={css(INPUT)} required /></label>
      <label style={css("display:flex;flex-direction:column;gap:5px")}><span style={css(MONO)}>Nova senha</span><input aria-label="Nova senha" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} style={css(INPUT)} placeholder="mínimo 6 caracteres" required /></label>
      <label style={css("display:flex;flex-direction:column;gap:5px")}><span style={css(MONO)}>Repita a nova senha</span><input aria-label="Repita a nova senha" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} style={css(INPUT)} required /></label>
    </div>
    {erro && <p role="alert" style={css("margin:0;font-size:12.5px;color:#B4302F")}>{erro}</p>}
    <div><button type="submit" disabled={salvando || !atual || !nova || !confirma} style={css(PRIMARY)}>{salvando ? "Trocando…" : "Trocar senha"}</button></div>
  </form>;
}

type Nivel = "gestao" | "grupo" | "asa";
type NivelAniv = "off" | "lista" | "mural";
type Privacidade = { tel: Nivel; mail: Nivel; bday: NivelAniv };
type Janela = { on: boolean; de: string; ate: string };
type Regras = { silencio: Janela; lembreteCheckinMin: number };
const PRIVACIDADE_PADRAO: Privacidade = { tel: "grupo", mail: "gestao", bday: "mural" };
const NIVEIS: [Nivel, string][] = [["gestao", "só gestão"], ["grupo", "meu grupo"], ["asa", "toda a ASA"]];
const NIVEIS_ANIV: [NivelAniv, string][] = [["off", "não aparece"], ["lista", "só na lista"], ["mural", "mural no meu dia"]];
const SILENCIO_CASA: [string, string, Janela][] = [["2206", "22h às 06h", { on: true, de: "22:00", ate: "06:00" }], ["2307", "23h às 07h", { on: true, de: "23:00", ate: "07:00" }], ["off", "sem silêncio", { on: false, de: "22:00", ate: "06:00" }]];
const chaveSilencio = (j: Janela) => !j.on ? "off" : j.de === "23:00" && j.ate === "07:00" ? "2307" : j.de === "22:00" && j.ate === "06:00" ? "2206" : "";

/** Foto por trás da API autenticada: busca como blob e mostra por URL local. */
function useFoto(userId: string | undefined, photoUrl: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !photoUrl) { setSrc(null); return; }
    let url: string | null = null, vivo = true;
    customFetch<Blob>(photoUrl, { responseType: "blob" }).then((blob) => { if (!vivo) return; url = URL.createObjectURL(blob); setSrc(url); }).catch(() => setSrc(null));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [userId, photoUrl]);
  return src;
}

/** Reduz a foto no aparelho (256 px, JPEG) antes de enviar: leve para o celular e para o banco. */
async function reduzirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height), alvo = 256;
  const canvas = document.createElement("canvas"); canvas.width = alvo; canvas.height = alvo;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, alvo, alvo);
  return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("foto")), "image/jpeg", 0.85));
}

function Opcoes<T extends string>({ rotulo, valor, opcoes, onPick, disabled }: { rotulo: string; valor: T; opcoes: [T, string][]; onPick: (v: T) => void; disabled?: boolean }) {
  return <div role="radiogroup" aria-label={rotulo} style={css("display:flex;gap:6px;flex-wrap:wrap;flex:none")}>
    {opcoes.map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={valor === v} disabled={disabled} onClick={() => valor !== v && onPick(v)} style={css(optionStyle(valor === v))}>{label}</button>)}
  </div>;
}

function Linha({ label, note, children, tag }: { label: string; note: string; children: ReactNode; tag?: ReactNode }) {
  return <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 13px;background:#faf9fe;border:1px solid #f0ecf8;border-radius:13px")}>
    <div style={css("flex:1 1 260px;min-width:200px;display:flex;flex-direction:column;gap:2px")}>
      <span style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}><span style={css("font-size:13px;font-weight:700")}>{label}</span>{tag}</span>
      <span style={css("font-size:11.5px;line-height:1.45;color:#6b6482")}>{note}</span>
    </div>
    {children}
  </div>;
}

export default function PerfilPage({ role }: { role: ShellRole }) {
  const { user, isAuthenticated, updateCurrentUser } = useAuth();
  const signOut = useSignOut();
  const me = user as unknown as (Me & { photoUrl?: string | null; birthDate?: string | null; privacidade?: Privacidade; silencio?: Janela | null }) | null;
  const [nomeUso, setNomeUso] = useState(""), [telefone, setTelefone] = useState(""), [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false), [aviso, setAviso] = useState(""), [senhaAberta, setSenhaAberta] = useState(false);
  const [sessoes, setSessoes] = useState<number | null>(null);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [salvo, setSalvo] = useState(""), [enviandoFoto, setEnviandoFoto] = useState(false);
  const [silDe, setSilDe] = useState(""), [silAte, setSilAte] = useState("");
  const foto = useFoto(me?.id, me?.photoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!me) return;
    setNomeUso(me.displayName ?? me.name ?? ""); setTelefone(me.phone ?? ""); setEmail(me.email ?? "");
  }, [me?.id, me?.displayName, me?.phone, me?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarSessoes = useCallback(() => {
    if (!isAuthenticated) return;
    customFetch<{ abertas: number }>("/api/users/me/sessions").then((r) => setSessoes(r.abertas)).catch(() => setSessoes(null));
  }, [isAuthenticated]);
  useEffect(carregarSessoes, [carregarSessoes]);
  useEffect(() => { if (isAuthenticated) customFetch<{ regras: Regras }>("/api/organization/regras").then((r) => setRegras(r.regras)).catch(() => setRegras(null)); }, [isAuthenticated]);

  const privacidade: Privacidade = { ...PRIVACIDADE_PADRAO, ...(me?.privacidade ?? {}) };
  const janela: Janela | null = me?.silencio ?? regras?.silencio ?? null;
  useEffect(() => { if (janela) { setSilDe(janela.de); setSilAte(janela.ate); } }, [janela?.de, janela?.ate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated || !me) {
    return <section className="pf-root"><div className="pf-col"><div style={css(CARD)}><span style={css(H2)}>Perfil</span><span style={css(NOTE)}>Entre na sua conta para ver e mudar o que é seu: nome de uso, contato, senha e quem vê o quê.</span></div></div></section>;
  }

  const nome = me.displayName ?? me.name ?? "";
  const mudou = nomeUso.trim() !== nome || telefone.trim() !== (me.phone ?? "") || email.trim() !== (me.email ?? "");
  const marcarSalvo = (msg = "salvo · entrou no Registro") => { setSalvo(msg); window.setTimeout(() => setSalvo(""), 4000); };

  const salvar = async () => {
    if (!nomeUso.trim()) { setAviso("O nome de uso não pode ficar vazio."); return; }
    setSalvando(true); setAviso("");
    try {
      const r = await customFetch<{ user: unknown }>(`/api/users/${me.id}`, { method: "PATCH", body: JSON.stringify({ displayName: nomeUso.trim(), phone: telefone.trim() || null, email: email.trim() || null }) });
      updateCurrentUser(r.user as unknown as NonNullable<typeof user>);
      setAviso("Salvo. Entrou no Registro.");
    } catch (err) {
      setAviso(erroDe(err, "Não consegui salvar agora. Tente de novo."));
    } finally { setSalvando(false); }
  };

  const preferencias = async (body: { privacidade?: Partial<Privacidade>; silencio?: Janela | null }) => {
    setAviso("");
    try {
      const r = await customFetch<{ privacidade: Privacidade; silencio: Janela | null }>("/api/users/me/preferencias", { method: "PATCH", body: JSON.stringify(body) });
      updateCurrentUser({ ...(user as object), privacidade: r.privacidade, silencio: r.silencio } as unknown as NonNullable<typeof user>);
      marcarSalvo();
    } catch (err) { setAviso(erroDe(err, "Não consegui salvar a escolha. Tente de novo.")); }
  };
  const salvarJanela = (de: string, ate: string) => {
    if (!/^\d{2}:\d{2}$/.test(de) || !/^\d{2}:\d{2}$/.test(ate) || de === ate || !janela) return;
    if (de === janela.de && ate === janela.ate) return;
    void preferencias({ silencio: { on: janela.on, de, ate } });
  };

  const regra = async (body: Partial<Regras>) => {
    setAviso("");
    try { const r = await customFetch<{ regras: Regras }>("/api/organization/regras", { method: "PATCH", body: JSON.stringify(body) }); setRegras(r.regras); marcarSalvo("regra da casa salva · entrou no Registro"); }
    catch (err) { setAviso(erroDe(err, "Não consegui mudar a regra da casa. Tente de novo.")); }
  };

  const trocarFoto = async (file: File | undefined) => {
    if (!file) return;
    setEnviandoFoto(true); setAviso("");
    try {
      const blob = await reduzirFoto(file);
      const r = await customFetch<{ photoUrl: string }>("/api/users/me/photo", { method: "PUT", body: blob, headers: { "content-type": "image/jpeg" } });
      updateCurrentUser({ ...(user as object), photoUrl: r.photoUrl } as unknown as NonNullable<typeof user>);
      marcarSalvo("foto trocada");
    } catch (err) { setAviso(erroDe(err, "Não consegui trocar a foto. Use uma imagem JPG ou PNG.")); }
    finally { setEnviandoFoto(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const tirarFoto = async () => {
    try { await customFetch("/api/users/me/photo", { method: "DELETE" }); updateCurrentUser({ ...(user as object), photoUrl: null } as unknown as NonNullable<typeof user>); marcarSalvo("foto retirada"); }
    catch (err) { setAviso(erroDe(err, "Não consegui tirar a foto agora.")); }
  };

  const encerrarOutras = async () => {
    setAviso("");
    try {
      const r = await customFetch<{ sessoesEncerradas: number }>("/api/users/me/sessions/encerrar-outras", { method: "POST", body: JSON.stringify({ refreshToken: localStorage.getItem("myasa_refresh_token") }) });
      setAviso(r.sessoesEncerradas ? `${r.sessoesEncerradas === 1 ? "1 sessão encerrada" : `${r.sessoesEncerradas} sessões encerradas`}. Só este aparelho continua com a conta aberta.` : "Não havia outra sessão aberta.");
      carregarSessoes();
    } catch (err) { setAviso(erroDe(err, "Não consegui encerrar as outras sessões. Tente de novo.")); }
  };

  const campos = [
    { label: "Nome de uso", value: nomeUso, set: setNomeUso, type: "text", auto: "nickname", tag: "aparece no app" },
    { label: "Telefone", value: telefone, set: setTelefone, type: "tel", auto: "tel", tag: "seu" },
    { label: "E-mail", value: email, set: setEmail, type: "email", auto: "email", tag: "seu" },
  ];
  const bdayEcho = privacidade.bday === "mural"
    ? "No seu dia, seu nome sobe para o alto do mural de todo mundo, com dia e mês."
    : privacidade.bday === "lista" ? "Sua data aparece na lista da semana, mas você não sobe para o alto do mural no seu dia."
      : "Você não aparece em lugar nenhum: nem na lista da semana, nem no alto do mural.";
  const lembreteMin = regras?.lembreteCheckinMin ?? 30;
  const avisos: { label: string; sub: string; how: "push" | "no app" }[] = [
    { label: "Aviso esperando seu ciente", sub: "e fica no Mural até você confirmar", how: "push" },
    { label: "Escala publicada ou alterada", sub: "troca de última hora na escala do dia chega na hora, sempre", how: "push" },
    { label: "Check-in do dia", sub: `${lembreteMin} min antes do seu primeiro bloco`, how: "push" },
    { label: "O resto (Mural, folgas, tarefas, mensagens)", sub: "aparece no app, no sininho e no Meu Dia", how: "no app" },
  ];
  const semSilencioProprio = !me.silencio;

  return <section className="pf-root">
    <div className="pf-col">
      <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:15px;flex-wrap:wrap")}>
        {foto ? <img src={foto} alt={`Foto de ${nome}`} style={css("width:64px;height:64px;border-radius:50%;object-fit:cover;flex:none")}/>
          : <span style={css("width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#3b45d9);flex:none;display:flex;align-items:center;justify-content:center;font-family:Outfit,sans-serif;font-size:22px;font-weight:700;color:#fff")}>{initials(nome)}</span>}
        <div style={css("flex:1 1 300px;min-width:200px;display:flex;flex-direction:column;gap:4px")}>
          <span style={css("font-family:Outfit,sans-serif;font-size:20px;font-weight:700;line-height:1.2")}>{nome}</span>
          <span style={css("font-size:12.5px;color:#6b6482")}>{ROLE_NAME[role]}{me.username ? ` · entra como ${me.username}` : ""}</span>
          <span style={css(NOTE)}>Nome completo, área e perfil de acesso são cadastro — mudam em Pessoas, com a Administração.</span>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:7px;flex:none;align-items:flex-start")}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void trocarFoto(e.target.files?.[0])}/>
          <button type="button" className="pf-hit" disabled={enviandoFoto} onClick={() => fileRef.current?.click()} style={css(LINK)}>{enviandoFoto ? "enviando…" : foto ? "trocar foto" : "colocar foto"}</button>
          {foto && <button type="button" className="pf-hit" onClick={() => void tirarFoto()} style={css(LINK + ";color:#6b6482")}>tirar foto</button>}
          <button type="button" className="pf-hit" onClick={() => setSenhaAberta((v) => !v)} style={css(LINK)} aria-expanded={senhaAberta}>{senhaAberta ? "fechar senha" : "mudar senha"}</button>
        </div>
      </div>

      {senhaAberta && <MudarSenha onDone={(msg) => { setSenhaAberta(false); setAviso(msg); carregarSessoes(); }}/>}

      <div style={css(CARD)}>
        <div style={css("display:flex;align-items:baseline;gap:10px;flex-wrap:wrap")}><span style={css(H2)}>O que é seu para mudar</span><span style={css("flex:1")}/><span style={css(NOTE)}>nome completo, vínculo e perfil de acesso só mudam em Pessoas</span></div>
        <div className="pf-fields">
          {campos.map((f) => <label key={f.label} style={css("display:flex;flex-direction:column;gap:5px")}>
            <span style={css("display:flex;gap:8px;align-items:center")}><span style={css(MONO)}>{f.label}</span><span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;color:#6C2BF2;background:#f1ebfe;padding:2px 7px;border-radius:5px")}>{f.tag}</span></span>
            <input aria-label={f.label} type={f.type} autoComplete={f.auto} value={f.value} onChange={(e) => f.set(e.target.value)} style={css(INPUT)} />
          </label>)}
        </div>
        <div className="pf-save" style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
          <button type="button" disabled={!mudou || salvando} onClick={salvar} style={css(PRIMARY)}>{salvando ? "Salvando…" : "Salvar o que mudou"}</button>
        </div>
      </div>

      <div style={css(CARD + ";gap:13px")}>
        <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <span style={css(H2)}>Quem vê o que sobre você</span>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#B03C7D;background:#fbeaf3;padding:4px 9px;border-radius:6px")}>Sua escolha, de ninguém mais</span>
          <span style={css("flex:1")}/>
          {salvo && <span role="status" style={css("font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:999px;color:#0E8F86;background:#e3f4f1")}>{salvo}</span>}
        </div>
        <Linha label="Telefone" note="quem consegue ligar para você direto do cartão do grupo"><Opcoes rotulo="Quem vê seu telefone" valor={privacidade.tel} opcoes={NIVEIS} onPick={(v) => void preferencias({ privacidade: { tel: v } })}/></Linha>
        <Linha label="E-mail" note="aparece no cartão de quem pode ver"><Opcoes rotulo="Quem vê seu e-mail" valor={privacidade.mail} opcoes={NIVEIS} onPick={(v) => void preferencias({ privacidade: { mail: v } })}/></Linha>
        <Linha label="Data de nascimento" note="dia e mês, nunca o ano — e o mural é da ASA inteira, não só do seu grupo"><Opcoes rotulo="Seu aniversário" valor={privacidade.bday} opcoes={NIVEIS_ANIV} onPick={(v) => void preferencias({ privacidade: { bday: v } })}/></Linha>
        <div style={css("display:flex;align-items:center;gap:10px;padding:11px 13px;background:#fbeaf3;border:1px solid #f4d3e5;border-radius:13px")}>
          <img src="/asa/lembrete.webp" alt="" style={css("width:32px;height:32px;object-fit:contain;flex:none")}/>
          <span style={css("font-size:12px;line-height:1.5;color:#6b2d55")}>{me.birthDate ? bdayEcho : "Sua data de nascimento ainda não está no cadastro — a Administração coloca em Pessoas. Enquanto isso, nada aparece."}</span>
        </div>
      </div>

      <div style={css(CARD + ";gap:12px")}>
        <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <span style={css(H2)}>Como o My ASA te avisa</span>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6482;background:#f0eef5;padding:4px 9px;border-radius:6px")}>Sem chave para desligar</span>
        </div>
        <span style={css("font-size:12px;line-height:1.5;color:#5b5473")}>{role === "adm" ? "É a lista que vale para a casa inteira; cada pessoa vê a mesma no perfil dela, em leitura." : "Você não desliga nada disso, e ninguém desliga por você. A casa decide o que interrompe; aqui você confere o que vai chegar."}</span>
        {janela && <Linha label="Silêncio noturno" tag={<span style={css("font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#0E8F86;background:#e3f4f1;padding:3px 7px;border-radius:5px")}>A única coisa sua aqui</span>}
          note={!janela.on ? "Desligado: tudo chega na hora que acontece, de madrugada inclusive." : `${semSilencioProprio ? "Você segue o horário da casa. " : ""}Nesse intervalo o push espera a manhã — aviso marcado como urgente e troca de última hora atravessam de qualquer forma.`}>
          <div style={css("display:flex;align-items:center;gap:7px;flex:none")}>
            <input aria-label="Silêncio começa" type="time" value={silDe} disabled={!janela.on} onChange={(e) => setSilDe(e.target.value)} onBlur={() => salvarJanela(silDe, silAte)} style={css("width:96px;border:1px solid #e6e1f2;border-radius:9px;padding:8px 8px;font:700 12.5px 'JetBrains Mono',monospace;color:#3d3559;background:#fff;min-height:40px")}/>
            <span style={css("font-size:11.5px;color:#6b6482")}>às</span>
            <input aria-label="Silêncio termina" type="time" value={silAte} disabled={!janela.on} onChange={(e) => setSilAte(e.target.value)} onBlur={() => salvarJanela(silDe, silAte)} style={css("width:96px;border:1px solid #e6e1f2;border-radius:9px;padding:8px 8px;font:700 12.5px 'JetBrains Mono',monospace;color:#3d3559;background:#fff;min-height:40px")}/>
            <button type="button" role="switch" aria-checked={janela.on} aria-label="Silêncio noturno ligado" onClick={() => void preferencias({ silencio: { ...janela, on: !janela.on } })}
              style={css("cursor:pointer;flex:none;width:46px;height:27px;border-radius:999px;border:none;padding:3px;display:flex;align-items:center;" + (janela.on ? "background:#0E8F86;justify-content:flex-end;" : "background:#e0dbec;justify-content:flex-start;"))}>
              <span style={css("display:block;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(40,20,90,.35)")}/>
            </button>
          </div>
        </Linha>}
        {!semSilencioProprio && regras && <button type="button" className="pf-hit" onClick={() => void preferencias({ silencio: null })} style={css(LINK + ";align-self:flex-start")}>voltar ao horário da casa ({regras.silencio.on ? `${regras.silencio.de}–${regras.silencio.ate}` : "sem silêncio"})</button>}
        <div style={css("display:flex;flex-direction:column")}>
          {avisos.map((n, i) => <div key={n.label} style={css("display:flex;align-items:center;gap:11px;padding:11px 2px;" + (i ? "border-top:1px solid #f5f2fa;" : ""))}>
            <span style={css("flex:none;width:7px;height:7px;border-radius:50%;background:" + (n.how === "push" ? "#6C2BF2" : "#d8d2e6"))}/>
            <span style={css("flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px")}><span style={css("font-size:13px;font-weight:600")}>{n.label}</span><span style={css("font-size:11px;color:#6b6482")}>{n.sub}</span></span>
            <span style={css("flex:none;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:6px;" + (n.how === "push" ? "color:#6C2BF2;background:#f1ebfe;" : "color:#6b6482;background:#f4f2fa;"))}>{n.how}</span>
          </div>)}
        </div>
      </div>

      {role === "adm" && regras && <div style={css("background:#6C2BF20a;border:1px solid #6C2BF233;border-radius:16px;padding:15px 18px;display:flex;flex-direction:column;gap:12px")}>
        <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <span style={css(H2)}>Regras da organização</span>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6C2BF2;background:#6C2BF21a;padding:4px 9px;border-radius:6px")}>vale para todo mundo</span>
        </div>
        <span style={css("font-size:12.5px;line-height:1.5;color:#4a4363")}>Isto não é preferência sua — é como o My ASA se comporta para a casa inteira. Só a Administração muda, e cada mudança fica no Registro com nome e hora.</span>
        <Linha label="Lembrete de check-in" note="quanto antes do primeiro bloco de cada pessoa o push de check-in chega">
          <Opcoes rotulo="Antecedência do lembrete de check-in" valor={String(regras.lembreteCheckinMin)} opcoes={[["15", "15 min antes"], ["30", "30 min antes"], ["60", "1 hora antes"]]} onPick={(v) => void regra({ lembreteCheckinMin: Number(v) })}/>
        </Linha>
        <Linha label="Silêncio noturno da casa" note="o padrão que cada pessoa pode deslocar no perfil dela; urgente atravessa sempre">
          <Opcoes rotulo="Silêncio noturno da casa" valor={chaveSilencio(regras.silencio)} opcoes={SILENCIO_CASA.map(([k, l]) => [k, l] as [string, string])} onPick={(k) => void regra({ silencio: SILENCIO_CASA.find(([c]) => c === k)![2] })}/>
        </Linha>
        <span style={css("font-size:12px;line-height:1.5;color:#5b5473;background:#fff;border:1px dashed #ddd6ee;border-radius:12px;padding:11px 13px")}>Sem chave, aqui nem em lugar nenhum: a idade da pessoa não aparece, e ninguém silencia tipo de aviso para si — só o horário do silêncio noturno é escolha de cada um.</span>
      </div>}

      {aviso && <span role="status" style={css("font-size:12.5px;color:#5b5473")}>{aviso}</span>}

      <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 16px;background:#fff;border:1px solid #e6e1f2;border-radius:16px")}>
        <div style={css("display:flex;flex-direction:column;gap:2px;min-width:0")}>
          <span style={css("font-size:13px;font-weight:700")}>Sessões abertas</span>
          <span style={css(NOTE)}>{sessoes === null ? "—" : sessoes <= 1 ? "só este aparelho" : `${sessoes} aparelhos com a conta aberta, contando este`}</span>
        </div>
        <span style={css("flex:1")}/>
        {sessoes !== null && sessoes > 1 && <button type="button" className="pf-hit" onClick={encerrarOutras} style={css(LINK)}>encerrar as outras</button>}
        <button type="button" onClick={() => void signOut()} style={css("cursor:pointer;font-family:Manrope,sans-serif;font-size:12.5px;font-weight:700;color:#B4302F;background:#fff;border:1px solid #f0d3d3;border-radius:999px;padding:9px 18px;min-height:44px;display:inline-flex;align-items:center;gap:6px")}><LogOut size={15}/> Sair da conta</button>
      </div>
    </div>
  </section>;
}
