import { useState, useEffect, ReactNode } from "react";
import { setAuthTokenGetter, getMe } from "@workspace/api-client-react";
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
    const token = localStorage.getItem("myasa_access_token");
    const userStr = localStorage.getItem("myasa_user");
    const rolesStr = localStorage.getItem("myasa_roles");

    if (!token || !userStr || !rolesStr) {
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    setAuthTokenGetter(() => localStorage.getItem("myasa_access_token"));

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
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User, roles: UserRole[]) => {
    localStorage.setItem("myasa_access_token", accessToken);
    localStorage.setItem("myasa_refresh_token", refreshToken);
    localStorage.setItem("myasa_user", JSON.stringify(user));
    localStorage.setItem("myasa_roles", JSON.stringify(roles));
    setAuthTokenGetter(() => accessToken);
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
