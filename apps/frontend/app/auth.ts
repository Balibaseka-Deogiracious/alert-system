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
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
  metrics: {
    users: number;
    moderators: number;
    students: number;
    system_admins: number;
    departments: number;
    lost_items: number;
    found_items: number;
    pending_claims: number;
    claims: number;
    active_alerts: number;
    alerts: number;
    stations: number;
    faculties: number;
    audit_events_24h: number;
    roles: number;
  };
  role_counts: Record<string, number>;
  departments: { name: string; users: number }[];
  sections: Record<string, { eyebrow: string; title: string; description: string; metrics: [string, string, string][]; records: [string, string, string][] }>;
  items: { item_id: string; reporter_id: string; item_type: "lost" | "found"; item_name: string; category: string | null; description: string; location: string; status: string; created_at: string | null }[];
  claims: { claim_id: string; student_id: string; student_name: string; item_name: string; location: string; status: string; created_at: string | null }[];
  alerts: { alert_id: number; title: string; message: string; audience: string; status: string; created_at: string | null }[];
  stations: { station_id: number; name: string; campus: string; lockers: number; created_at: string | null }[];
  faculties: { faculty_id: number; name: string; campus: string; created_at: string | null }[];
  audit_events: { event_id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; details: string | null; created_at: string | null }[];
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

export async function createAdminUser(account: { firstName: string; lastName: string; email: string; password: string; studentId: string; faculty: string }): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: account.firstName, last_name: account.lastName, email: account.email, password: account.password, student_id: account.studentId, faculty: account.faculty || null }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to create user account.");
  return data.user as AdminUser;
}

export async function createAdminItem(item: { reporterId: string; itemType: "lost" | "found"; itemName: string; category?: string; description: string; location: string; imageData?: string; status?: string }): Promise<AdminDashboard["items"][number]> {
  const response = await fetch(`${API_URL}/system/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reporter_id: item.reporterId, item_type: item.itemType, item_name: item.itemName, category: item.category || null, description: item.description, location: item.location, image_data: item.imageData || null, status: item.status || null }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to save item report.");
  return data.item as AdminDashboard["items"][number];
}

export async function updateAdminItem(itemId: string, item: { itemName: string; category?: string; description: string; location: string; status: string }): Promise<AdminDashboard["items"][number]> {
  const response = await fetch(`${API_URL}/system/items/${encodeURIComponent(itemId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_name: item.itemName, category: item.category || null, description: item.description, location: item.location, status: item.status.toLowerCase().replaceAll(" ", "_") }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to update item.");
  return data.item as AdminDashboard["items"][number];
}

export async function updateAdminClaim(claimId: string, status: string): Promise<void> {
  const response = await fetch(`${API_URL}/system/claims/${encodeURIComponent(claimId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status.toLowerCase().replaceAll(" ", "_") }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to update claim.");
}

export async function createAdminFaculty(faculty: { name: string; campus: string }): Promise<{ id: number; name: string; campus: string }> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/faculties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(faculty) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to create faculty.");
  return data.faculty as { id: number; name: string; campus: string };
}

export async function createAdminStation(station: { name: string; campus: string; lockers: number }): Promise<{ id: number; name: string; campus: string; lockers: number }> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/stations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(station) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to create recovery station.");
  return data.station as { id: number; name: string; campus: string; lockers: number };
}

export async function createAdminAlert(alert: { title: string; message: string; audience: string }): Promise<{ id: number; title: string; message: string; audience: string; status: string }> {
  const response = await fetch(`${API_URL}/system/admin-dashboard/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(alert) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to create alert.");
  return data.alert as { id: number; title: string; message: string; audience: string; status: string };
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
  if (!data.account || typeof data.account !== "object" || typeof data.account.role !== "string") {
    throw new Error("The account service returned an incomplete account.");
  }
  return { ...data.account, role: normalizeRole(data.account.role) } as Session;
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

function normalizeRole(role: string): AccountRole {
  const normalizedRole = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "system_admin") return "system_admin";
  if (normalizedRole === "moderator") return "moderator";
  return "student";
}

export function dashboardPath(role: string): string {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "system_admin") return "/system-admin";
  return normalizedRole === "moderator" ? "/admin" : "/student";
}
