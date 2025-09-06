const KEY = "access_token";

export function setAccessToken(t?: string | null) {
  if (t) localStorage.setItem(KEY, t);
  else localStorage.removeItem(KEY);
}
export function getAccessToken(): string | null {
  return localStorage.getItem(KEY);
}
export function clearAccessToken() {
  localStorage.removeItem(KEY);
}
