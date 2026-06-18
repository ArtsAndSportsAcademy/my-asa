import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { User, UserRole } from "@workspace/api-client-react";

interface AuthState {
  user: User | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User, roles: UserRole[]) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    
    setAuthTokenGetter(() => localStorage.getItem("myasa_access_token"));

    if (token && userStr && rolesStr) {
      try {
        setState({
          user: JSON.parse(userStr),
          roles: JSON.parse(rolesStr),
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (e) {
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
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
    localStorage.removeItem("myasa_access_token");
    localStorage.removeItem("myasa_refresh_token");
    localStorage.removeItem("myasa_user");
    localStorage.removeItem("myasa_roles");
    setAuthTokenGetter(null);
    setState({ user: null, roles: [], isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
