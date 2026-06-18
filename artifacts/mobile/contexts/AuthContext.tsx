import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  status: string;
  organizationId: string;
}

export interface AuthRole {
  id: string;
  userId: string;
  operationId: string;
  groupId: string | null;
  role: "ADMIN" | "SUPERVISOR_A" | "SUPERVISOR_B" | "MEMBER";
  active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  roles: AuthRole[];
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (accessToken: string, refreshToken: string, user: AuthUser, roles: AuthRole[]) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  roles: [],
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_DOMAIN) {
      setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
    }

    setAuthTokenGetter(async () => {
      return await AsyncStorage.getItem("myasa_access_token");
    });

    (async () => {
      try {
        const [storedToken, storedUser, storedRoles] = await Promise.all([
          AsyncStorage.getItem("myasa_access_token"),
          AsyncStorage.getItem("myasa_user"),
          AsyncStorage.getItem("myasa_roles"),
        ]);

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);
          setRoles(storedRoles ? (JSON.parse(storedRoles) as AuthRole[]) : []);
        }
      } catch {
        // ignore parse errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (
    token: string,
    refreshToken: string,
    authUser: AuthUser,
    authRoles: AuthRole[],
  ) => {
    await Promise.all([
      AsyncStorage.setItem("myasa_access_token", token),
      AsyncStorage.setItem("myasa_refresh_token", refreshToken),
      AsyncStorage.setItem("myasa_user", JSON.stringify(authUser)),
      AsyncStorage.setItem("myasa_roles", JSON.stringify(authRoles)),
    ]);
    setAccessToken(token);
    setUser(authUser);
    setRoles(authRoles);
  };

  const signOut = async () => {
    await Promise.all([
      AsyncStorage.removeItem("myasa_access_token"),
      AsyncStorage.removeItem("myasa_refresh_token"),
      AsyncStorage.removeItem("myasa_user"),
      AsyncStorage.removeItem("myasa_roles"),
    ]);
    setAuthTokenGetter(null);
    setAccessToken(null);
    setUser(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        accessToken,
        isAuthenticated: !!accessToken,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
