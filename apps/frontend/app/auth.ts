export type AccountRole = "student" | "moderator" | "system_admin";

export type Account = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: AccountRole;
  studentId?: string;
  faculty?: string;
};

export type Session = Omit<Account, "password">;

const SESSION_KEY = "unialert-session";
export const API_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:8000/api`
  : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export type AdminUser = {
  initials: string;
  name: string;
  id: string;
  role: string;
  status: string;
  lastSeen: string;
  faculty?: string;
  email: string;
};

export type AdminDashboard = {
  users: AdminUser[];
  metrics: { users: number; moderators: number; students: number; departments: number };
  departments: { name: string; users: number }[];
  sections: Record<string, { eyebrow: string; title: string; description: string; metrics: [string, string, string][]; records: [string, string, string][] }>;
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const response = await fetch(`${API_URL}/system/admin-dashboard`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to load the admin dashboard.");
  return data as AdminDashboard;
}

export async function updateAdminUser(id: string, role: string, faculty: string): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/users/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, faculty: faculty || null }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to update account.");
  return data.user as AdminUser;
}

export async function createAdminModerator(account: { firstName: string; lastName: string; email: string; password: string; studentId: string; faculty: string }): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/moderators`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: account.firstName, last_name: account.lastName, email: account.email, password: account.password, student_id: account.studentId, faculty: account.faculty || null }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to create moderator account.");
  return data.user as AdminUser;
}

export async function deleteAdminUser(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to delete account.");
}

export async function submitClaim(claim: { studentId: string; studentName: string; itemName: string; location: string }): Promise<void> {
  const response = await fetch(`${API_URL}/system/claims`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: claim.studentId, student_name: claim.studentName, item_name: claim.itemName, location: claim.location }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to submit claim.");
}

export function setSession(account: Account | Session): void {
  const { password: _password, ...session } = account as Account;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function registerAccount(account: Pick<Account, "firstName" | "lastName" | "email" | "password">): Promise<Session> {
  const response = await fetch(`${API_URL}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: account.firstName, last_name: account.lastName, email: account.email, password: account.password }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Registration failed.");
  return data.account as Session;
}

export async function loginAccount(email: string, password: string): Promise<Session> {
  const response = await fetch(`${API_URL}/auth/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Sign-in failed.");
  return data.account as Session;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function dashboardPath(role: AccountRole): string {
  if (role === "system_admin") return "/system-admin";
  return role === "moderator" ? "/admin" : "/student";
}
