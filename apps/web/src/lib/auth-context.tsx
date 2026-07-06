"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setAccessToken } from "./api";

interface User {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("http://localhost:3001/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      setToken(data.access_token);
      setAccessToken(data.access_token);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const data = await apiFetch<{ user: User }>("/api/auth/me");
          setUser(data.user);
        } catch {
          setToken(null);
          setAccessToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!token || loading) return;
    const timeout = setTimeout(
      () => {
        refreshAccessToken().then((ok) => {
          if (!ok) {
            setUser(null);
            setToken(null);
          }
        });
      },
      14 * 60 * 1000,
    );
    return () => clearTimeout(timeout);
  }, [token, loading, refreshAccessToken]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: User }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    setToken(data.access_token);
    setAccessToken(data.access_token);
    setUser(data.user);
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setToken(null);
      setAccessToken(null);
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
