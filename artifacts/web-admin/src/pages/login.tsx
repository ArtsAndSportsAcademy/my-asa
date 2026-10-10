import { type FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { ApiError, customFetch, useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { lembrarSenhaDaEntrada } from "@/lib/senha-da-entrada";
import "./login.css";

// Desenho 01 · Entrada: usuário e senha, sem e-mail. Quem redefine a senha é a Administração.
type Tela = "entrar" | "esqueci" | "desativada";

const MENSAGEM_DE_ERRO: Record<string, string> = {
  ACCOUNT_UNCONFIGURED: "Sua conta ainda não tem perfil de acesso. Peça à Administração para definir.",
  GUEST_ACCESS_EXPIRED: "Seu acesso de convidado terminou. Se precisa continuar, fale com a Administração.",
};

function Marca() {
  return <div className="lg-marca">
    <img src="/asa-wing.png" alt="" />
    <div><b>My ASA</b><span>Arts and Sports Academy</span></div>
  </div>;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: authenticate } = useAuth();
  const loginMutation = useLogin();
  const [tela, setTela] = useState<Tela>("entrar");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ enviando: boolean; resposta: string | null; erro: string | null }>({ enviando: false, resposta: null, erro: null });

  const entrar = (event: FormEvent) => {
    event.preventDefault();
    setErro(null);
    if (!usuario.trim() || !senha) { setErro("Preencha o usuário e a senha."); return; }
    loginMutation.mutate(
      { data: { username: usuario.trim().toLowerCase(), password: senha } },
      {
        onSuccess: (result) => {
          if ((result.user as { mustChangePassword?: boolean }).mustChangePassword) lembrarSenhaDaEntrada(senha);
          authenticate(result.accessToken, result.refreshToken, result.user, result.roles, (result as any).capabilities ?? []);
          setLocation("/meu-dia");
        },
        onError: (err) => {
          const codigo = err instanceof ApiError ? (err.data as { error?: string } | null)?.error : undefined;
          if (codigo === "USER_INACTIVE") { setTela("desativada"); return; }
          if (codigo && MENSAGEM_DE_ERRO[codigo]) { setErro(MENSAGEM_DE_ERRO[codigo]); return; }
          if (!(err instanceof ApiError)) { setErro("Sem conexão. Tente de novo quando a internet voltar."); return; }
          // Só 401 é senha errada. Dizer "senha não confere" quando o servidor falhou faz a
          // pessoa revisar a senha dez vezes atrás de um problema que não é dela.
          if (err.status !== 401) { setErro(`O servidor não respondeu direito agora (erro ${err.status}). Não é a sua senha — tente de novo em um minuto.`); return; }
          setErro("Usuário ou senha não conferem.");
        },
      },
    );
  };

  const avisarAdministracao = async (event: FormEvent) => {
    event.preventDefault();
    if (!usuario.trim()) { setPedido({ enviando: false, resposta: null, erro: "Escreva o seu usuário para a Administração saber quem é." }); return; }
    setPedido({ enviando: true, resposta: null, erro: null });
    try {
      const r = await customFetch<{ message: string }>("/api/auth/esqueci-senha", { method: "POST", body: JSON.stringify({ username: usuario.trim().toLowerCase() }) });
      setPedido({ enviando: false, resposta: r.message, erro: null });
    } catch {
      setPedido({ enviando: false, resposta: null, erro: "Não consegui avisar agora. Tente de novo em alguns segundos." });
    }
  };

  const voltar = () => { setTela("entrar"); setPedido({ enviando: false, resposta: null, erro: null }); setErro(null); };

  return <div className="lg-tela">
    <aside className="lg-lado">
      <Marca />
      <p className="lg-lema">A escala, o livro do dia e as folgas da Arts and Sports Academy em um lugar só.</p>
    </aside>

    <main className="lg-miolo">
      <div className="lg-topo-celular"><Marca /></div>
      <section className="lg-cartao">
        {tela === "entrar" && <form onSubmit={entrar} noValidate>
          <h1>Entrar</h1>
          {erro && <p className="lg-erro" role="alert">{erro}</p>}
          <label className="lg-campo">
            <span>Usuário</span>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="seu.usuario" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
          </label>
          <label className="lg-campo">
            <span>Senha</span>
            <span className="lg-senha">
              <input type={mostrar ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={() => setMostrar((v) => !v)} aria-pressed={mostrar} aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"}>{mostrar ? "esconder" : "mostrar"}</button>
            </span>
          </label>
          <button type="submit" className="lg-principal" disabled={loginMutation.isPending}>{loginMutation.isPending ? "Entrando…" : "Entrar"}</button>
          <button type="button" className="lg-link" onClick={() => { setTela("esqueci"); setErro(null); }}>Esqueci minha senha</button>
        </form>}

        {tela === "esqueci" && <form onSubmit={avisarAdministracao} noValidate>
          <h1>Esqueci minha senha</h1>
          <h2>Quem redefine é a Administração</h2>
          <p>O My ASA não usa e-mail. A Administração define uma senha provisória e te passa. Você entra com ela e cria a sua na hora — ninguém da ASA vê a senha que você escolher.</p>
          {pedido.resposta ? <p className="lg-ok" role="status">{pedido.resposta}</p> : <>
            <label className="lg-campo">
              <span>Seu usuário</span>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="seu.usuario" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
            </label>
            {pedido.erro && <p className="lg-erro" role="alert">{pedido.erro}</p>}
            <button type="submit" className="lg-principal" disabled={pedido.enviando}>{pedido.enviando ? "Avisando…" : "Avisar a Administração"}</button>
          </>}
          <button type="button" className="lg-link" onClick={voltar}>Voltar para entrar</button>
        </form>}

        {tela === "desativada" && <div>
          <h1>Sua conta está desativada</h1>
          <p>Costuma acontecer no fim de um contrato ou de uma temporada.</p>
          <h2>Seus dados continuam guardados</h2>
          <p>Escala, folgas e reconhecimentos ficam no histórico da ASA. Se você voltar, a Administração reativa a mesma conta — nada se perde e você não recomeça do zero.</p>
          <p className="lg-nota">Para voltar ou pedir uma cópia dos seus dados, fale com a Administração.</p>
          <button type="button" className="lg-link" onClick={voltar}>Voltar para entrar</button>
        </div>}
      </section>
      <p className="lg-ajuda">Precisa de ajuda? Fale com a Administração da ASA.</p>
    </main>
  </div>;
}
