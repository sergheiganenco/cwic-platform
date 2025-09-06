
import api from "@services/http";
 // adjust ../ depth to reach /src/services/http
import { clearAccessToken, setAccessToken } from "./token";

export async function login(creds: { email: string; password: string }) {
  const { data } = await api.post("/auth/login", creds);
  const access = (data as any)?.accessToken;
  if (access) setAccessToken(access);           // if your backend returns it
  return data;
}

export function logout() {
  clearAccessToken();
  // optionally call /auth/logout server route if you have it
}
