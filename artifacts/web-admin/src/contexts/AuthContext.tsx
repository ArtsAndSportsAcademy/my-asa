import { useState, useEffect, ReactNode } from "react";
import {
  setAuthTokenGetter,
  setAuthRefreshHandler,
  getMe,
  refreshToken as refreshTokenRequest,
} from "@workspace/api-client-react";
import type { User, UserRole } from "@workspace/api-client-react";
import { AuthContext } from "./authContext";

interface AuthState {
  user: User | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

function clearStorage() {
  localStorage.removeItem("myasa_access_token");
  localStorage.removeItem("myasa_refresh_token");
  localStorage.removeItem("myasa_user");
  localStorage.removeItem("myasa_roles");
  setAuthTokenGetter(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    roles: [],
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
        setState({ user: null, roles: [], isAuthenticated: false, isLoading: false });
        return null;
      }
    });

    const token = localStorage.getItem("myasa_access_token");
    const userStr = localStorage.getItem("myasa_user");
    const rolesStr = localStorage.getItem("myasa_roles");

    const cleanup = () => {
      setAuthRefreshHandler(null);
    };

    if (!token || !userStr || !rolesStr) {
      setState(s => ({ ...s, isLoading: false }));
      return cleanup;
    }

    getMe()
      .then(() => {
        try {
          setState({
            user: JSON.parse(userStr),
            roles: JSON.parse(rolesStr),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          clearStorage();
          setState({ user: null, roles: [], isAuthenticated: false, isLoading: false });
        }
      })
      .catch(() => {
        clearStorage();
        setState({ user: null, roles: [], isAuthenticated: false, isLoading: false });
      });

    return cleanup;
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User, roles: UserRole[]) => {
    localStorage.setItem("myasa_access_token", accessToken);
    localStorage.setItem("myasa_refresh_token", refreshToken);
    localStorage.setItem("myasa_user", JSON.stringify(user));
    localStorage.setItem("myasa_roles", JSON.stringify(roles));
    setAuthTokenGetter(() => localStorage.getItem("myasa_access_token"));
    setState({ user, roles, isAuthenticated: true, isLoading: false });
  };

  const logout = () => {
    clearStorage();
    setState({ user: null, roles: [], isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
