"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowDownToLine, Check, ChevronDown, CircleHelp, ClipboardCheck,
  Database, FileClock, FileText, KeyRound, LayoutDashboard, MapPin, Menu,
  PanelLeftClose, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal,
  ToggleLeft, Trash2, UserPlus, UsersRound, X
} from "lucide-react";
import { ProfileDropdown, ThemeToggle } from "../theme-provider";
import { AdminDashboard, AdminUser, createAdminModerator, deleteAdminUser, getAdminDashboard, getSession, registerAccount, Session, updateAdminUser } from "../auth";

type Role = {
  name: string;
  description: string;
  members: string;
  scope: string;
  tone: "navy" | "blue" | "teal" | "coral" | "gray";
};

const roles: Role[] = [
  { name: "Student", description: "Report and search property, submit claims, and receive safety alerts.", members: "38,420", scope: "Self-service", tone: "blue" },
  { name: "Faculty Moderator", description: "Review reports, verify matches, and monitor recovery operations.", members: "18", scope: "Faculty / department", tone: "teal" },
  { name: "Campus Safety / Dispatch", description: "Manage emergency operations, dispatch, and authorized broadcasts.", members: "12", scope: "Campus-wide", tone: "coral" },
  { name: "Recovery / Custody Staff", description: "Receive, store, verify, and hand over recovered property.", members: "26", scope: "Assigned hubs", tone: "gray" },
  { name: "System Administrator", description: "Manage users, roles, permissions, locations, categories, security, and audit settings.", members: "3", scope: "Platform-wide", tone: "navy" },
];

type UserRecord = AdminUser;

const auditEvents = [
  { action: "Permission policy updated", actor: "Maya Chen", time: "09:42", detail: "Claim Approvals: dual authorization enabled", tone: "blue" },
  { action: "New recovery station registered", actor: "System Admin", time: "08:17", detail: "North Commons Concierge / Hub 09", tone: "teal" },
  { action: "Role assignment changed", actor: "Maya Chen", time: "Yesterday", detail: "Lena Cooper moved to Faculty Moderator", tone: "coral" },
  { action: "Security key rotated", actor: "System Admin", time: "Yesterday", detail: "Campus SSO signing key #7", tone: "gray" },
];

const permissions = [
  ["Manage student accounts", "Create, suspend, and restore user access"],
  ["Assign operational roles", "Change role scope and faculty membership"],
  ["Configure recovery taxonomy", "Edit categories, item types, and matching rules"],
  ["Manage recovery locations", "Register hubs, lockers, and custody desks"],
  ["View security audit logs", "Read immutable administrative activity"],
  ["Change platform security", "SSO, session policy, and API key controls"],
];

type AdminSection = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: [string, string, string][];
  recordsTitle: string;
  records: [string, string, string][];
};

type SectionChartData = {
  totalLabel: string;
  total: string;
  barTitle: string;
  barItems: [string, number][];
  lineTitle: string;
  lineValues: number[];
  lineLabels: string[];
  pieTitle: string;
  pieValues: [string, number, string][];
};

const sectionCharts: Record<string, SectionChartData> = {
  "Users & Access": {
    totalLabel: "Total users in system",
    total: "38,479",
    barTitle: "Users by access role",
    barItems: [["Students", 38420], ["Moderators", 18], ["Safety", 12], ["Custody", 26], ["Admins", 3]],
    lineTitle: "Directory growth",
    lineValues: [28, 31, 30, 35, 34, 38, 42],
    lineLabels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
    pieTitle: "Account verification",
    pieValues: [["Verified", 98.2, "#1b9f91"], ["Review", 1.3, "#7cb9ff"], ["Pending", 0.5, "#f1b5b5"]],
  },
  "Moderator Team": {
    totalLabel: "Total moderators",
    total: "18",
    barTitle: "Moderators by campus",
    barItems: [["Central", 5], ["West", 4], ["North", 3], ["East", 3], ["South", 3]],
    lineTitle: "Moderators on duty",
    lineValues: [12, 15, 14, 17, 16, 18, 18],
    lineLabels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "Now"],
    pieTitle: "Moderator availability",
    pieValues: [["On duty", 72, "#1b9f91"], ["Available", 17, "#7cb9ff"], ["Review", 11, "#f1b5b5"]],
  },
  "Faculties & Departments": {
    totalLabel: "Users across departments",
    total: "38,479",
    barTitle: "Users by department",
    barItems: [["Computer Eng.", 8420], ["Medical Bio", 6910], ["Business", 5740], ["Education", 4860], ["Arts", 3910], ["Other", 8639]],
    lineTitle: "Department directory activity",
    lineValues: [24, 29, 27, 35, 32, 39, 44],
    lineLabels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"],
    pieTitle: "Department share",
    pieValues: [["Top 3 departments", 54, "#1b9f91"], ["Other departments", 38, "#7cb9ff"], ["Unassigned", 8, "#f1b5b5"]],
  },
};

const adminSections: Record<string, AdminSection> = {
  "Users & Access": {
    eyebrow: "Identity directory",
    title: "Users & Access",
    description: "Govern student, staff, and privileged access across every campus operation.",
    metrics: [["38,479", "directory users", "98.2% verified"], ["21", "privileged accounts", "2 reviews due"], ["184", "access events / 24h", "No anomalies"]],
    recordsTitle: "Access review queue",
    records: [["Sofia Alvarez", "MOD-2041 • Faculty Moderator", "Active • MFA verified"], ["Officer J. Vargas", "ADM-1007 • Campus Safety / Dispatch", "Active • 2 min ago"], ["Lena Cooper", "MOD-1988 • Faculty Moderator", "Review required • Yesterday"]],
  },
  "Moderator Team": {
    eyebrow: "Operational staffing",
    title: "Moderator Team",
    description: "Monitor moderator coverage, escalation ownership, and platform privileges for live operations.",
    metrics: [["18", "moderators on duty", "6 campuses covered"], ["4", "escalation leads", "100% shift coverage"], ["2", "reviews due", "Next review Friday"]],
    recordsTitle: "Current duty roster",
    records: [["Officer J. Vargas", "Lead Dispatcher • Campus-wide", "Online • Claims escalation"], ["Sofia Alvarez", "Faculty Moderator • West Campus", "Reviewing • 11 min ago"], ["Malik Rahman", "Recovery / Custody Staff • Hub 04", "Online • Custody handoff"]],
  },
  "Recovery Stations": {
    eyebrow: "Custody network",
    title: "Recovery Stations",
    description: "Oversee station availability, locker capacity, and custody handoffs across the campus network.",
    metrics: [["9", "registered stations", "8 currently open"], ["62%", "locker capacity", "24h SLA target"], ["31", "items in custody", "0 overdue handoffs"]],
    recordsTitle: "Station health",
    records: [["Central Police Dispatch", "18 lockers • Campus-wide", "Open • 84% capacity"], ["Library Main Service Desk", "9 lockers • North Campus", "Open • 46% capacity"], ["Student Union Information", "6 lockers • Central Campus", "Open • 33% capacity"]],
  },
  "Campus Broadcasts": {
    eyebrow: "Emergency communications",
    title: "Campus Broadcasts",
    description: "Control approved advisories and verify delivery across student, staff, and public display channels.",
    metrics: [["2", "live broadcasts", "12,410 recipients"], ["99.1%", "delivery rate", "All channels healthy"], ["3", "approval drafts", "2 require review"]],
    recordsTitle: "Broadcast control room",
    records: [["Science Quadrangle Access Restriction", "Push • Email • Hall displays", "Live • 12,410 delivered"], ["West Gym Theft Prevention Alert", "Push • Student mobile", "Advisory • 8,220 delivered"], ["Blue Line Shuttle Diversion", "Email • Public signage", "Scheduled • 14:00"]],
  },
  "Faculties & Departments": {
    eyebrow: "Campus directory",
    title: "Faculties & Departments",
    description: "Route operational ownership, escalation contacts, and property notifications across the university structure.",
    metrics: [["28", "departments", "100% contact coverage"], ["6", "escalation groups", "All owners assigned"], ["8", "campus zones", "3 active incidents"]],
    recordsTitle: "Department directory",
    records: [["Computer Engineering", "ICT Research Complex • 4 contacts", "Active • Escalation owner assigned"], ["Medical Biology", "West Science Quadrangle • 3 contacts", "Active • Notification ready"], ["Campus Facilities", "Central Operations • 8 contacts", "On call • 24h coverage"]],
  },
  "Audit & Compliance": {
    eyebrow: "Immutable oversight",
    title: "Audit & Compliance",
    description: "Review administrative actions, access changes, and custody events against platform governance policies.",
    metrics: [["184", "events in 24 hours", "No anomalies"], ["100%", "signed actions", "Hash chain healthy"], ["0", "open findings", "Last review today"]],
    recordsTitle: "Recent compliance events",
    records: auditEvents.map((event) => [event.action, `${event.actor} • ${event.detail}`, `${event.time} • Signed and immutable`]),
  },
  "System Settings": {
    eyebrow: "Platform control plane",
    title: "System Settings",
    description: "Configure global identity, notifications, retention, integrations, and operational safeguards for UniAlert.",
    metrics: [["12", "active policies", "All compliant"], ["7 years", "retention window", "Legal hold ready"], ["99.98%", "API uptime", "Last check 2 min ago"]],
    recordsTitle: "Global platform configuration",
    records: [["Identity & authentication", "SSO required • MFA for privileged accounts", "Healthy • Last changed 18m ago"], ["Notifications & broadcasts", "Push, email, and hall display channels", "Operational • 99.1% delivery"], ["Data retention & exports", "7-year retention • Encrypted audit exports", "Compliant • Reviewed today"], ["Integrations & API", "Campus directory, custody scanners, and webhooks", "Healthy • 4 connected services"]],
  },
};

function AdminSectionView({ section, records, chartData, onManage, onDelete }: { section: AdminSection; records?: [string, string, string][]; chartData?: SectionChartData; onManage?: () => void; onDelete?: (name: string) => void }) {
  const chart = chartData || sectionCharts[section.title];
  const sectionRecords = records || section.records;

  return <div className="admin-section-view">
    <div className="system-heading section-heading"><div><div className="system-eyebrow"><b>{section.eyebrow}</b><span>Super administrator workspace</span></div><h1>{section.title}</h1><p>{section.description}</p></div>{onManage ? <button className="system-primary" onClick={onManage}><UserPlus size={14} /> {section.title === "Moderator Team" ? "Add moderator" : "Add user"}</button> : <button className="system-primary"><Settings2 size={14} /> Manage section</button>}</div>
    <div className="section-kpis">{section.metrics.map(([value, label, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    {chart && <SectionCharts data={chart} />}
    <section className="system-panel section-records"><div className="system-panel-heading"><div><span>Administrative view</span><h2>{section.recordsTitle}</h2><p>Current records and platform state for this control area.</p></div><button><ArrowDownToLine size={13} /> Export view</button></div><div className="section-record-list">{sectionRecords.map(([name, detail, status], index) => <div className="section-record" key={`${name}-${index}`}><span className="section-record-number">{String(index + 1).padStart(2, "0")}</span><span><b>{name}</b><small>{detail}</small></span><strong>{status}</strong>{onDelete ? <button className="section-delete" onClick={() => onDelete(name)} aria-label={`Delete ${name}`}><Trash2 size={15} /></button> : <button aria-label={`Open ${name}`}><ChevronDown size={15} /></button>}</div>)}</div></section>
  </div>;
}

function SectionCharts({ data }: { data: SectionChartData }) {
  const maxBarValue = Math.max(...data.barItems.map(([, value]) => value));
  const linePoints = data.lineValues.map((value, index) => `${(index / (data.lineValues.length - 1)) * 100},${62 - value}`).join(" ");
  const pieTotal = data.pieValues.reduce((sum, [, value]) => sum + value, 0);
  let pieStart = 0;

  return <section className="section-charts" aria-label={`${data.totalLabel} charts`}>
    <article className="system-panel chart-total-card"><span>{data.totalLabel}</span><strong>{data.total}</strong><small>Current directory snapshot</small><div className="chart-total-meter"><i /></div></article>
    <article className="system-panel section-chart-panel"><div className="chart-panel-heading"><div><span>Distribution</span><h2>{data.barTitle}</h2></div><b>Total</b></div><div className="section-bar-chart">{data.barItems.map(([label, value]) => <div className="section-bar-item" key={label}><div className="section-bar-track"><i style={{ height: `${Math.max((value / maxBarValue) * 100, 4)}%` }} /></div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>)}</div></article>
    <article className="system-panel section-chart-panel"><div className="chart-panel-heading"><div><span>Trend</span><h2>{data.lineTitle}</h2></div><b>7 points</b></div><div className="section-line-chart"><div className="line-grid"><i /><i /><i /></div><svg viewBox="0 0 100 62" preserveAspectRatio="none" role="img" aria-label={`${data.lineTitle} line chart`}><polyline points={linePoints} /></svg></div><div className="section-chart-labels">{data.lineLabels.map((label) => <span key={label}>{label}</span>)}</div></article>
    <article className="system-panel section-chart-panel section-pie-panel"><div className="chart-panel-heading"><div><span>Composition</span><h2>{data.pieTitle}</h2></div><b>100%</b></div><div className="section-pie-layout"><div className="section-pie" style={{ background: `conic-gradient(${data.pieValues.map(([, value, color]) => { const start = pieStart; pieStart += (value / pieTotal) * 100; return `${color} ${start}% ${pieStart}%`; }).join(", ")})` }}><div><strong>{data.pieValues[0][1]}%</strong><small>{data.pieValues[0][0]}</small></div></div><div className="section-pie-legend">{data.pieValues.map(([label, value, color]) => <span key={label}><i style={{ background: color }} /><b>{label}</b><strong>{value}%</strong></span>)}</div></div></article>
  </section>;
}

export default function SystemAdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Overview");
  const [selectedRole, setSelectedRole] = useState("System Administrator");
  const [search, setSearch] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [manageMode, setManageMode] = useState<"user" | "moderator" | null>(null);
  const [userRecords, setUserRecords] = useState<UserRecord[]>([]);
  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [dataError, setDataError] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [newPerson, setNewPerson] = useState({ name: "", id: "", email: "", password: "", faculty: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "system_admin" || session.email !== "kijjambujoseph@kyu.ac.ug") router.replace("/signin");
    else setSession(session);
  }, [router]);

  useEffect(() => {
    getAdminDashboard().then((data) => { setAdminData(data); setUserRecords(data.users); }).catch((error) => setDataError(error instanceof Error ? error.message : "Unable to load admin data."));
  }, []);
  const adminName = session ? `${session.firstName} ${session.lastName}` : "System Administrator";
  const adminInitials = session ? `${session.firstName[0] || ""}${session.lastName[0] || ""}`.toUpperCase() : "SA";
  const adminId = session?.studentId || "SYS-0001";
  const adminEmail = session?.email || "";
  const moderators = userRecords.filter((user) => user.role === "moderator");
  const roleLabel = (role: string) => role === "moderator" ? "Faculty Moderator" : role === "system_admin" ? "System Administrator" : "Student";
  const filteredUsers = userRecords.filter((user) => `${user.name} ${user.id} ${user.role} ${user.faculty || ""}`.toLowerCase().includes(search.toLowerCase()));
  const userSection: AdminSection = { ...adminSections["Users & Access"], metrics: [[String(adminData?.metrics.users || 0), "directory users", "Live database total"], [String(userRecords.filter((user) => user.role !== "student").length), "privileged accounts", "Managed by admin"], ["184", "access events / 24h", "No anomalies"]] };
  const moderatorSection: AdminSection = { ...adminSections["Moderator Team"], metrics: [[String(adminData?.metrics.moderators || 0), "moderators on duty", "Live database total"], [String(moderators.filter((moderator) => moderator.faculty).length), "assigned faculties", "Coverage tracked"], ["0", "reviews due", "Database status"]] };
  const userChart: SectionChartData = { ...sectionCharts["Users & Access"], total: String(adminData?.metrics.users || 0), barItems: [["Students", userRecords.filter((user) => user.role === "student").length], ["Moderators", moderators.length], ["Admins", userRecords.filter((user) => user.role === "system_admin").length]] };
  const moderatorChart: SectionChartData = { ...sectionCharts["Moderator Team"], total: String(adminData?.metrics.moderators || 0), barItems: adminData?.departments.filter((department) => moderators.some((moderator) => moderator.faculty === department.name)).map((department) => [department.name, moderators.filter((moderator) => moderator.faculty === department.name).length] as [string, number]) || [] };
  const departmentChart: SectionChartData = { ...sectionCharts["Faculties & Departments"], total: String(adminData?.metrics.users || 0), barItems: adminData?.departments.map((department) => [department.name, department.users]) || [] };
  const liveSection = activeSection === "Users & Access" ? userSection : activeSection === "Moderator Team" ? moderatorSection : adminData?.sections[activeSection] as AdminSection | undefined;

  const openManageModal = (mode: "user" | "moderator") => {
    setNewPerson({ name: "", id: "", email: "", password: "", faculty: "" });
    setManageMode(mode);
  };

  const addPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameParts = newPerson.name.trim().split(/\s+/).filter(Boolean);
    if (manageMode === "moderator") {
      const [firstName, ...lastNames] = nameParts;
      const created = await createAdminModerator({ firstName: firstName || "", lastName: lastNames.join(" "), email: newPerson.email.trim().toLowerCase(), password: newPerson.password, studentId: newPerson.id.trim(), faculty: newPerson.faculty.trim() });
      setUserRecords((current) => [created, ...current]);
      setAdminData((current) => current ? { ...current, users: [created, ...current.users], metrics: { ...current.metrics, users: current.metrics.users + 1, moderators: current.metrics.moderators + 1 } } : current);
      setManageMode(null);
      return;
    }
    const created = await registerAccount({ firstName: nameParts[0] || "", lastName: nameParts.slice(1).join(" "), email: newPerson.email.trim().toLowerCase(), password: newPerson.password });
    const initials = nameParts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "US";
    const added: AdminUser = { initials, name: newPerson.name.trim(), id: created.studentId || newPerson.id.trim(), role: "student", status: "Active", lastSeen: "Just now", faculty: newPerson.faculty.trim() || undefined, email: newPerson.email.trim().toLowerCase() };
    setUserRecords((current) => [...current, added]);
    setAdminData((current) => current ? { ...current, users: [added, ...current.users], metrics: { ...current.metrics, users: current.metrics.users + 1, students: current.metrics.students + 1 } } : current);
    setManageMode(null);
  };

  const deletePerson = async (name: string) => {
    const user = userRecords.find((record) => record.name === name);
    if (!user) return;
    await deleteAdminUser(user.id);
    setUserRecords((current) => current.filter((record) => record.id !== user.id));
  };

  const changeUserRole = async (role: "student" | "moderator") => {
    if (!selectedUser) return;
    const updated = await updateAdminUser(selectedUser.id, role, selectedUser.faculty || "");
    setUserRecords((current) => current.map((user) => user.id === updated.id ? updated : user));
    setSelectedUser(null);
  };

  const userSectionRecords: [string, string, string][] = userRecords.map((user) => [user.name, `${user.id} • ${roleLabel(user.role)}${user.faculty ? ` • ${user.faculty}` : ""}`, `${user.status} • ${user.lastSeen}`]);
  const moderatorSectionRecords: [string, string, string][] = moderators.map((moderator) => [moderator.name, `${moderator.id} • ${moderator.faculty || "Faculty not assigned"}`, `${moderator.status} • ${moderator.lastSeen}`]);

  return (
    <div className="system-admin-shell">
      <header className="system-topbar">
        <div className="system-brand">
          <span className="system-mark"><ShieldCheck size={15} /></span>
          <span><b>UniAlert</b><small>System Administration</small></span>
        </div>
        <div className="system-context"><Database size={14} /> Platform Control Center <span>•</span> All campuses</div>
        <div className="system-actions">
          <label className="system-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, roles, logs..." /></label><ThemeToggle />
          <button className="system-icon" aria-label="Help"><CircleHelp size={16} /></button>
          <ProfileDropdown name={adminName} initials={adminInitials} role="System Administrator" summary="Platform governance and access control" email={adminEmail} />
        </div>
      </header>

      <button className="system-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open administration navigation"><Menu size={20} /></button>
      {sidebarOpen && <button className="system-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close administration navigation" />}

      <aside className={`system-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="system-user"><span className="system-avatar large">{adminInitials}</span><span><b>{adminName}</b><small>{adminId} / Super Admin</small></span><button onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><PanelLeftClose size={16} /></button></div>
        <div className="system-nav-label">Platform governance</div>
        <nav className="system-nav">
                {["Overview", "Users & Access", "Moderator Team", "Recovery Stations", "Campus Broadcasts", "Faculties & Departments", "Audit & Compliance", "System Settings"].map((item) => (
            <button key={item} className={activeSection === item ? "selected" : ""} onClick={() => { setActiveSection(item); setSidebarOpen(false); }}>
              {item === "Overview" && <LayoutDashboard size={15} />}
              {item === "Users & Access" && <UsersRound size={15} />}
                    {item === "Moderator Team" && <ShieldCheck size={15} />}
              {item === "Recovery Stations" && <MapPin size={15} />}
              {item === "Campus Broadcasts" && <Activity size={15} />}
              {item === "Faculties & Departments" && <Database size={15} />}
              {item === "Audit & Compliance" && <FileClock size={15} />}
              {item === "System Settings" && <Settings2 size={15} />}
              <span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="system-status-card"><span><i /> SYSTEM STATUS</span><strong>All services operational</strong><small>Last integrity check 2 min ago</small><footer><span>API uptime</span><b>99.98%</b></footer></div>
      </aside>

      <main className="system-main">
        <div className="system-workspace">
          <section className="system-content">
            {activeSection !== "Overview" ? (liveSection ? <AdminSectionView section={liveSection} chartData={activeSection === "Users & Access" ? userChart : activeSection === "Moderator Team" ? moderatorChart : activeSection === "Faculties & Departments" ? departmentChart : undefined} records={activeSection === "Users & Access" ? userSectionRecords : activeSection === "Moderator Team" ? moderatorSectionRecords : undefined} onManage={activeSection === "Users & Access" ? () => openManageModal("user") : activeSection === "Moderator Team" ? () => openManageModal("moderator") : undefined} onDelete={activeSection === "Users & Access" || activeSection === "Moderator Team" ? deletePerson : undefined} /> : <div className="directory-empty">Loading database records...</div>) : <>
            {dataError && <div className="auth-error">{dataError}</div>}
            <div className="system-heading">
              <div><div className="system-eyebrow"><b>System Administrator</b><span>Least privilege enforced</span></div><h1>Platform governance &amp; access control</h1><p>Manage identity, permissions, configuration, and the audit trail behind every campus operation.</p></div>
              <div className="system-heading-actions"><button className="system-secondary"><ArrowDownToLine size={14} /> Export audit log</button><button className="system-primary" onClick={() => setShowRoleModal(true)}><Plus size={14} /> Create role</button></div>
            </div>

            <div className="admin-alert"><div className="admin-alert-icon"><ShieldCheck size={17} /></div><div><b>Security posture is healthy</b><p>All privileged accounts use SSO and multi-factor authentication. Two access reviews are due this week.</p></div><button onClick={() => setActiveSection("System Settings")}>Review settings</button></div>

            <div className="system-kpis">
              <article><span>Directory users</span><strong>{adminData?.metrics.users ?? 0}</strong><small className="good"><Check size={11} /> Live database total</small></article>
              <article><span>Active roles</span><strong>5</strong><small><KeyRound size={11} /> 1 platform role</small></article>
              <article><span>Privileged accounts</span><strong>{userRecords.filter((user) => user.role !== "student").length}</strong><small className="warning"><ShieldCheck size={11} /> Live database total</small></article>
              <article><span>Audit events / 24h</span><strong>184</strong><small className="blue"><Activity size={11} /> No anomalies</small></article>
            </div>

            <div className="system-grid-top">
              <section className="system-panel role-panel">
                <div className="system-panel-heading"><div><span>Access model</span><h2>Role structure</h2><p>Five role families separate operational work from platform administration.</p></div><button onClick={() => setShowRoleModal(true)}><SlidersHorizontal size={14} /> Manage roles</button></div>
                <div className="role-list">{roles.map((role) => <button key={role.name} className={`role-row ${selectedRole === role.name ? "active" : ""}`} onClick={() => setSelectedRole(role.name)}><span className={`role-icon ${role.tone}`}><ShieldCheck size={15} /></span><span className="role-copy"><b>{role.name}</b><small>{role.description}</small></span><span className="role-meta"><b>{role.members}</b><small>{role.scope}</small></span><ChevronDown size={15} /></button>)}</div>
              </section>

              <section className="system-panel permission-panel">
                <div className="system-panel-heading"><div><span>Selected role</span><h2>{selectedRole}</h2><p>Platform-wide access policy and assigned capabilities.</p></div><span className="policy-badge">Protected</span></div>
                <div className="permission-list">{permissions.map(([title, detail], index) => <label key={title} className="permission-row"><span><b>{title}</b><small>{detail}</small></span><input type="checkbox" defaultChecked={index !== 5} /><i /></label>)}</div>
                <div className="permission-footer"><span><ShieldCheck size={13} /> Changes require audit reason</span><button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>{saved ? "Saved" : "Save policy"}</button></div>
              </section>
            </div>

            <section className="system-panel users-panel">
              <div className="system-panel-heading"><div><span>Identity directory</span><h2>User access reviews</h2><p>Review active staff access, role scope, and recent authentication activity.</p></div><div className="directory-actions"><button><FilterIcon /> All statuses</button><button className="system-secondary" onClick={() => openManageModal("user")}><UserPlus size={13} /> Add user</button></div></div>
              <div className="directory-table"><div className="directory-head"><span>User</span><span>Role assignment</span><span>Last activity</span><span>Status</span><span /></div>{filteredUsers.map((user) => <div className="directory-row" key={user.id}><div className="directory-user"><span className="directory-avatar">{user.initials}</span><span><b>{user.name}</b><small>{user.id}</small></span></div><div><b>{roleLabel(user.role)}</b><small>{user.faculty || "No faculty assigned"}</small></div><div><b>{user.lastSeen}</b><small>{user.email}</small></div><span className={`user-status ${user.status.toLowerCase()}`}>{user.status}</span><button className="row-action" onClick={() => setSelectedUser(user)} aria-label={`Change profile for ${user.name}`}><SlidersHorizontal size={15} /></button></div>)}{filteredUsers.length === 0 && <div className="directory-empty">No users match your search.</div>}</div>
            </section>

            <div className="system-grid-bottom">
              <section className="system-panel configuration-panel"><div className="system-panel-heading"><div><span>Platform configuration</span><h2>Operational settings</h2></div><Settings2 size={16} /></div><div className="config-list"><div><span><MapPin size={14} /><b>Recovery stations</b></span><strong>9 registered</strong></div><div><span><ClipboardCheck size={14} /><b>Item categories</b></span><strong>14 active</strong></div><div><span><ToggleLeft size={14} /><b>Matching engine</b></span><strong className="online">Enabled</strong></div><div><span><Database size={14} /><b>Retention policy</b></span><strong>7 years</strong></div></div><button className="configuration-link" onClick={() => setActiveSection("System Settings")}>Open settings center <span>→</span></button></section>
              <section className="system-panel audit-panel"><div className="system-panel-heading"><div><span>Immutable activity</span><h2>Recent audit events</h2></div><button onClick={() => setActiveSection("Audit & Compliance")}>View all</button></div><div className="audit-list">{auditEvents.map((event) => <div className="audit-row" key={event.action}><span className={`audit-dot ${event.tone}`} /><span><b>{event.action}</b><small>{event.detail}</small></span><time><b>{event.time}</b><small>{event.actor}</small></time></div>)}</div></section>
            </div>
            </>}
          </section>
        </div>
      </main>

      {manageMode && <div className="system-modal-backdrop"><form className="system-modal" onSubmit={addPerson} role="dialog" aria-modal="true" aria-labelledby="person-modal-title"><button type="button" className="system-modal-close" onClick={() => setManageMode(null)} aria-label="Close"><X size={17} /></button><span className="system-modal-icon"><UserPlus size={19} /></span><h2 id="person-modal-title">{manageMode === "moderator" ? "Add faculty moderator" : "Add system user"}</h2><p>{manageMode === "moderator" ? "Create a moderator account that can sign in to the moderator dashboard." : "Create a user account for the UniAlert directory."}</p><label>Full name<input required value={newPerson.name} onChange={(event) => setNewPerson({ ...newPerson, name: event.target.value })} placeholder="e.g. Jordan Lee" /></label><label>{manageMode === "moderator" ? "Moderator email" : "User email"}<input required type="email" pattern="^[^\s@]+@(std\.)?kyu\.ac\.ug$" title="Use a valid KYU email" value={newPerson.email} onChange={(event) => setNewPerson({ ...newPerson, email: event.target.value })} placeholder="name@kyu.ac.ug" /></label><label>{manageMode === "moderator" ? "Moderator password" : "Password"}<input required type="password" minLength={8} value={newPerson.password} onChange={(event) => setNewPerson({ ...newPerson, password: event.target.value })} placeholder="At least 8 characters" /></label><label>{manageMode === "moderator" ? "Moderator ID" : "User ID"}<input required value={newPerson.id} onChange={(event) => setNewPerson({ ...newPerson, id: event.target.value })} placeholder={manageMode === "moderator" ? "e.g. MOD-2094" : "e.g. STU-483920"} /></label><label>{manageMode === "moderator" ? "Assign faculty or campus" : "Faculty or department (optional)"}<input value={newPerson.faculty} onChange={(event) => setNewPerson({ ...newPerson, faculty: event.target.value })} placeholder="e.g. Computer Engineering" /></label><div className="system-modal-actions"><button type="button" className="system-secondary" onClick={() => setManageMode(null)}>Cancel</button><button type="submit" className="system-primary"><Check size={14} /> {manageMode === "moderator" ? "Add moderator" : "Add user"}</button></div></form></div>}
      {selectedUser && <div className="system-modal-backdrop"><div className="system-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title"><button className="system-modal-close" onClick={() => setSelectedUser(null)} aria-label="Close"><X size={17} /></button><span className="system-modal-icon"><SlidersHorizontal size={19} /></span><h2 id="profile-modal-title">Change profile</h2><p>{selectedUser.name} • {selectedUser.email}</p><label>Faculty or department<input value={selectedUser.faculty || ""} onChange={(event) => setSelectedUser({ ...selectedUser, faculty: event.target.value })} placeholder="e.g. Computer Engineering" /></label><div className="system-modal-actions"><button className="system-secondary" onClick={() => setSelectedUser(null)}>Cancel</button>{selectedUser.role === "moderator" ? <button className="system-primary" onClick={() => changeUserRole("student")}>Make student</button> : <button className="system-primary" onClick={() => changeUserRole("moderator")}>Make moderator</button>}</div></div></div>}
      {showRoleModal && <div className="system-modal-backdrop"><div className="system-modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title"><button className="system-modal-close" onClick={() => setShowRoleModal(false)} aria-label="Close"><X size={17} /></button><span className="system-modal-icon"><KeyRound size={19} /></span><h2 id="role-modal-title">Create a platform role</h2><p>New roles start with no permissions. Assign only the capabilities required for the role's operational scope.</p><label>Role name<input placeholder="e.g. Regional Custody Lead" /></label><label>Scope<select defaultValue="Campus-wide"><option>Campus-wide</option><option>Faculty / department</option><option>Assigned recovery hubs</option></select></label><div className="system-modal-actions"><button className="system-secondary" onClick={() => setShowRoleModal(false)}>Cancel</button><button className="system-primary" onClick={() => setShowRoleModal(false)}><Check size={14} /> Create draft role</button></div></div></div>}
    </div>
  );
}

function FilterIcon() {
  return <span className="filter-icon"><SlidersHorizontal size={13} /></span>;
}
