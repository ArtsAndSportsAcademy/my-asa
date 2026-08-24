import { createContext } from "react";
import type { User, UserRole } from "@workspace/api-client-react";

interface AuthState {
  user: User | null;
  roles: UserRole[];
  capabilities: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User, roles: UserRole[], capabilities?: string[]) => void;
  logout: () => void;
  markPasswordChanged: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
