import { type FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { useChangeMyPassword } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { esquecerSenhaDaEntrada, regrasDaSenha, senhaDaEntrada } from "@/lib/senha-da-entrada";
import "./login.css";

// Desenho 01 · Primeiro acesso: só a senha nova e a repetição, com as regras se marcando enquanto digita.
// A senha provisória já foi digitada na entrada; se a página recarregou, ela é pedida de novo.
export default function ForcePasswordChange() {
  const { user, markPasswordChanged, logout } = useAuth();
  const changeMutation = useChangeMyPassword();
  const lembrada = senhaDaEntrada();
  const [provisoria, setProvisoria] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const regras = regrasDaSenha(nova, repetida);
  const nome = (user as { displayName?: string | null } | null)?.displayName ?? user?.name?.split(" ")[0] ?? "";

  const enviar = (event: FormEvent) => {
    event.preventDefault();
    setErro(null);
    const atual = lembrada ?? provisoria;
    if (!atual) { setErro("Escreva a senha provisória que a Administração te passou."); return; }
    if (!regras.every((regra) => regra.ok)) { setErro("A senha nova ainda não cumpre as três regras."); return; }
    if (nova === atual) { setErro("A senha nova precisa ser diferente da provisória."); return; }
    changeMutation.mutate(
      // A sessão deste aparelho continua; as outras são encerradas pelo servidor.
      { data: { currentPassword: atual, newPassword: nova, refreshToken: localStorage.getItem("myasa_refresh_token") ?? undefined } as { currentPassword: string; newPassword: string } },
      {
        onSuccess: () => { esquecerSenhaDaEntrada(); markPasswordChanged(); },
        onError: (err: any) => {
          const status = err?.status ?? err?.response?.status;
          setErro(status === 401 ? "A senha provisória não confere. Confira com a Administração." : err?.data?.message ?? "Não consegui criar a senha agora. Tente de novo.");
        },
      },
    );
  };

  return <div className="lg-tela">
    <aside className="lg-lado">
      <div className="lg-marca"><img src="/asa-wing.png" alt="" /><div><b>My ASA</b><span>Arts and Sports Academy</span></div></div>
      <p className="lg-lema">Boas-vindas{nome ? `, ${nome}` : ""}. A senha que você recebeu vale só desta vez.</p>
    </aside>
    <main className="lg-miolo">
      <div className="lg-topo-celular"><div className="lg-marca"><img src="/asa-wing.png" alt="" /><div><b>My ASA</b><span>Primeiro acesso</span></div></div></div>
      <section className="lg-cartao">
        <form onSubmit={enviar} noValidate>
          <h1>{nome ? `Oi, ${nome}` : "Crie a sua senha"}</h1>
          <p>Antes de entrar, crie a sua senha. A que a Administração te passou vale só desta vez.</p>
          {erro && <p className="lg-erro" role="alert">{erro}</p>}
          {!lembrada && <label className="lg-campo">
            <span>Senha provisória</span>
            <input type="password" value={provisoria} onChange={(e) => setProvisoria(e.target.value)} autoComplete="current-password" placeholder="a que a Administração te passou" />
          </label>}
          <label className="lg-campo">
            <span>Nova senha</span>
            <span className="lg-senha">
              <input type={mostrar ? "text" : "password"} value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
              <button type="button" onClick={() => setMostrar((v) => !v)} aria-pressed={mostrar} aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"}>{mostrar ? "esconder" : "mostrar"}</button>
            </span>
          </label>
          <label className="lg-campo">
            <span>Repetir a senha</span>
            <input type={mostrar ? "text" : "password"} value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" placeholder="repita" />
          </label>
          <ul className="lg-regras" aria-label="Regras da senha">
            {regras.map((regra) => <li key={regra.texto} className={regra.ok ? "ok" : ""}><Check size={14} aria-hidden="true" />{regra.texto}<span className="sr-only">{regra.ok ? " — cumprida" : " — falta"}</span></li>)}
          </ul>
          <button type="submit" className="lg-principal" disabled={changeMutation.isPending}>{changeMutation.isPending ? "Criando…" : "Criar senha e entrar"}</button>
          <p className="lg-nota">Ninguém da ASA vê a sua senha, nem a Administração.</p>
          <button type="button" className="lg-link" onClick={() => { esquecerSenhaDaEntrada(); logout(); }} disabled={changeMutation.isPending}>Sair</button>
        </form>
      </section>
    </main>
  </div>;
}
