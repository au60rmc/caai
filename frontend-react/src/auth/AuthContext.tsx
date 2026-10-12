import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";

export interface Permission {
  module: string;
  module_order: number;
  feature: string;
  feature_code: string;
  feature_url: string;
  view: boolean;
  write: boolean;
  delete: boolean;
}

export interface UserInfo {
  id: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  user_email?: string;
  user_type?: string;
}

type Action = "view" | "write" | "delete";

interface AuthState {
  user: UserInfo | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
  changePassword: (
    current: string,
    next: string
  ) => Promise<{ ok: boolean; message: string }>;
  can: (featureCode: string, action?: Action) => boolean;
  demoLogin: (email: string) => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

const KEYS = {
  user: "current_user",
  perms: "user_permissions",
  mustChange: "must_change_password",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => load(KEYS.user, null));
  const [permissions, setPermissions] = useState<Permission[]>(() =>
    load<Permission[]>(KEYS.perms, [])
  );
  const [mustChangePassword, setMustChange] = useState<boolean>(
    () => localStorage.getItem(KEYS.mustChange) === "Y"
  );
  const [isAuthenticated, setAuthed] = useState<boolean>(() => !!getToken());

  useEffect(() => {
    const onUnauthorized = () => {
      clearStorage();
      setAuthed(false);
      setUser(null);
      setPermissions([]);
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const clearStorage = () => {
    clearToken();
    localStorage.removeItem(KEYS.user);
    localStorage.removeItem(KEYS.perms);
    localStorage.removeItem(KEYS.mustChange);
  };

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    const d = r.data || {};
    if (d.status === "SUCCESS" && d.result) {
      const res = d.result;
      setToken(res.access_token);
      localStorage.setItem(KEYS.user, JSON.stringify(res.user));
      localStorage.setItem(KEYS.perms, JSON.stringify(res.permissions || []));
      const mc = !!res.must_change_password;
      localStorage.setItem(KEYS.mustChange, mc ? "Y" : "N");
      setUser(res.user);
      setPermissions(res.permissions || []);
      setMustChange(mc);
      setAuthed(true);
      return { ok: true, message: "" };
    }
    return { ok: false, message: d.message || "Invalid credentials" };
  }, []);

  const demoLogin = useCallback(async (email: string) => {
    try {
      const r = await api.post("/auth/demo-login", { email });
      const d = r.data || {};
      if (d && typeof d === "object" && d.status === "SUCCESS" && d.result) {
        const res = d.result;
        setToken(res.access_token);
        localStorage.setItem(KEYS.user, JSON.stringify(res.user));
        localStorage.setItem(KEYS.perms, JSON.stringify(res.permissions || []));
        localStorage.setItem(KEYS.mustChange, "N");
        setUser(res.user);
        setPermissions(res.permissions || []);
        setMustChange(false);
        setAuthed(true);
        return { ok: true, message: "" };
      }
      const msg =
        typeof d === "string"
          ? (d.includes("FUNCTION_INVOCATION_FAILED") ? "Server starting up. Please retry in a few seconds." : d)
          : (d.message || d.detail || "Could not start demo");
      return { ok: false, message: msg };
    } catch (err: any) {
      return { ok: false, message: err.response?.data?.detail || err.message || "Network error. Is the backend updated?" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    clearStorage();
    setAuthed(false);
    setUser(null);
    setPermissions([]);
    setMustChange(false);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const r = await api.post("/auth/change-password", {
      current_password: current,
      new_password: next,
    });
    const d = r.data || {};
    if (d.status === "SUCCESS") {
      localStorage.setItem(KEYS.mustChange, "N");
      setMustChange(false);
      return { ok: true, message: "" };
    }
    return { ok: false, message: d.message || "Could not change password" };
  }, []);

  const can = useCallback(
    (featureCode: string, action: Action = "view") => {
      // Unrestricted mode: all features and actions (view, write, delete) are permitted
      return true;
    },
    []
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      permissions,
      isAuthenticated,
      mustChangePassword,
      login,
      logout,
      changePassword,
      can,
      demoLogin,
    }),
    [user, permissions, isAuthenticated, mustChangePassword, login, logout, changePassword, can, demoLogin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
