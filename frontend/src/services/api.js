import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authStorage = {
  getUser: () => {
    const raw = localStorage.getItem("auth_user");
    if (!raw) {
      return null;
    }

    try {
      const user = JSON.parse(raw);
      return user && typeof user === "object" ? user : null;
    } catch {
      // A stale or malformed browser session must never prevent the app from rendering.
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
      return null;
    }
  },
  setSession: (token, user) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    window.dispatchEvent(new Event("auth-change"));
  },
  clear: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.dispatchEvent(new Event("auth-change"));
  },
  getToken: () => localStorage.getItem("auth_token"),
};
