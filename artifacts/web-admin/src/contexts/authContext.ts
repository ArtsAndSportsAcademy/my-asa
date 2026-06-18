import { createContext } from "react";
import type { User, UserRole } from "@workspace/api-client-react";

interface AuthState {
  user: User | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User, roles: UserRole[]) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
