import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authStorage } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());

  useEffect(() => {
    const syncAuth = () => setUser(authStorage.getUser());

    window.addEventListener("auth-change", syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("auth-change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      setSession: (token, nextUser) => authStorage.setSession(token, nextUser),
      logout: () => authStorage.clear(),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
