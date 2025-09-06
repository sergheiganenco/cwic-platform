import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token";

let isRefreshing = false;
let queue: { resolve: (v?: unknown) => void; reject: (e: any) => void; config: AxiosRequestConfig }[] = [];

function flushQueue(error: any) {
  queue.splice(0).forEach(({ resolve, reject, config }) =>
    error ? reject(error) : resolve(api(config))
  );
}

export const api: AxiosInstance = axios.create({
  baseURL: "/api",            // Vite proxy will send this to the gateway
  withCredentials: true,      // needed if refresh/login use HttpOnly cookies
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const t = getAccessToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as any)["Authorization"] = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config!;
    if (err.response?.status === 401 && !(original as any)._retry) {
      (original as any)._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject, config: original }));
      }
      try {
        isRefreshing = true;
        const { data } = await axios.post("/auth/refresh", {}, { baseURL: "/api", withCredentials: true });
        const newAccess = (data as any)?.accessToken;
        if (!newAccess) throw new Error("No access token in refresh response");
        setAccessToken(newAccess);
        flushQueue(null);
        return api(original);
      } catch (e) {
        flushQueue(e);
        clearAccessToken();
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);
