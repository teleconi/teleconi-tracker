import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "teleconi_token";

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return token;
}

export async function setToken(t: string): Promise<void> {
  token = t;
  await storage.secureSet(TOKEN_KEY, t);
}

export async function clearToken(): Promise<void> {
  token = null;
  await storage.secureRemove(TOKEN_KEY);
}

async function req(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Terjadi kesalahan");
  }
  return res.status === 204 ? null : res.json();
}

export type ApiUser = {
  employee_id: string;
  name: string;
  role: string;
  ktp: string;
  bpjs: string;
  address: string;
  gaji: string;
  bank: string;
  no_rek: string;
  join_date: string;
  paid?: boolean;
};

export const api = {
  login: async (id: string, password: string) => {
    const body = new URLSearchParams({ username: id, password }).toString();
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Employee ID atau Password salah.");
    }
    return res.json() as Promise<{ access_token: string }>;
  },
  me: (): Promise<ApiUser> => req("/auth/me"),
  employees: (): Promise<{ employees: ApiUser[]; month: string; total_count: number }> => req("/employees"),
  updateEmployee: (id: string, data: Partial<ApiUser>): Promise<ApiUser> =>
    req(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  createEmployee: (data: Partial<ApiUser> & { employee_id: string }): Promise<ApiUser> =>
    req("/employees", { method: "POST", body: JSON.stringify(data) }),
  toggleSalary: (employee_id: string): Promise<{ employee_id: string; paid: boolean }> =>
    req("/salaries/toggle", { method: "POST", body: JSON.stringify({ employee_id }) }),
};
