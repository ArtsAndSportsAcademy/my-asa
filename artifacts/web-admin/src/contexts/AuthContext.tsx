import { useState, useEffect, ReactNode } from "react";
import {
  setAuthTokenGetter,
  setAuthRefreshHandler,
  getMe,
  refreshToken as refreshTokenRequest,
} from "@workspace/api-client-react";
import type { User, UserRole } from "@workspace/api-client-react";
import { AuthContext } from "./auth-context";

interface AuthState {
  user: User | null;
  roles: UserRole[];
  capabilities: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

function clearStorage() {
  localStorage.removeItem("myasa_access_token");
  localStorage.removeItem("myasa_refresh_token");
  localStorage.removeItem("myasa_user");
  localStorage.removeItem("myasa_roles");
  localStorage.removeItem("myasa_capabilities");
  setAuthTokenGetter(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    roles: [],
    capabilities: [],
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("myasa_access_token"));
    setAuthRefreshHandler(async () => {
      const storedRefresh = localStorage.getItem("myasa_refresh_token");
      if (!storedRefresh) return null;
      try {
        const tokens = await refreshTokenRequest({ refreshToken: storedRefresh });
        localStorage.setItem("myasa_access_token", tokens.accessToken);
        localStorage.setItem("myasa_refresh_token", tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        clearStorage();
        setState({ user: null, roles: [], capabilities: [], isAuthenticated: false, isLoading: false });
        return null;
      }
    });

    const token = localStorage.getItem("myasa_access_token");
    const userStr = localStorage.getItem("myasa_user");
    const rolesStr = localStorage.getItem("myasa_roles");
    const capabilitiesStr = localStorage.getItem("myasa_capabilities");

    const cleanup = () => {
      setAuthRefreshHandler(null);
    };

    if (!token || !userStr || !rolesStr) {
      setState(s => ({ ...s, isLoading: false }));
      return cleanup;
    }

    getMe()
      .then((result) => {
        try {
          const freshUser = (result?.user as User | undefined) ?? (JSON.parse(userStr) as User);
          const freshRoles = (result?.roles as UserRole[] | undefined) ?? (JSON.parse(rolesStr) as UserRole[]);
          const freshCapabilities = ((result as any)?.capabilities as string[] | undefined)
            ?? (capabilitiesStr ? JSON.parse(capabilitiesStr) as string[] : []);
          localStorage.setItem("myasa_user", JSON.stringify(freshUser));
          localStorage.setItem("myasa_roles", JSON.stringify(freshRoles));
          localStorage.setItem("myasa_capabilities", JSON.stringify(freshCapabilities));
          setState({
            user: freshUser,
            roles: freshRoles,
            capabilities: freshCapabilities,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          clearStorage();
          setState({ user: null, roles: [], capabilities: [], isAuthenticated: false, isLoading: false });
        }
      })
      .catch(() => {
        clearStorage();
        setState({ user: null, roles: [], capabilities: [], isAuthenticated: false, isLoading: false });
      });

    return cleanup;
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User, roles: UserRole[], capabilities: string[] = []) => {
    localStorage.setItem("myasa_access_token", accessToken);
    localStorage.setItem("myasa_refresh_token", refreshToken);
    localStorage.setItem("myasa_user", JSON.stringify(user));
    localStorage.setItem("myasa_roles", JSON.stringify(roles));
    localStorage.setItem("myasa_capabilities", JSON.stringify(capabilities));
    setAuthTokenGetter(() => localStorage.getItem("myasa_access_token"));
    setState({ user, roles, capabilities, isAuthenticated: true, isLoading: false });
  };

  const logout = () => {
    clearStorage();
    setState({ user: null, roles: [], capabilities: [], isAuthenticated: false, isLoading: false });
  };

  const markPasswordChanged = () => {
    setState((s) => {
      if (!s.user) return s;
      const updatedUser = { ...s.user, mustChangePassword: false };
      localStorage.setItem("myasa_user", JSON.stringify(updatedUser));
      return { ...s, user: updatedUser };
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}
