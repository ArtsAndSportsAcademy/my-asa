import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";

/** Sai da conta no servidor (derruba o refresh token) e no aparelho. Arquivo próprio para o shell não carregar o Perfil inteiro (D5). */
export function useSignOut() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  return async () => {
    const refreshToken = localStorage.getItem("myasa_refresh_token");
    try { if (refreshToken) await customFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }); } catch { /* sai no aparelho mesmo se a rede falhar */ }
    logout();
    setLocation("/login");
  };
}
