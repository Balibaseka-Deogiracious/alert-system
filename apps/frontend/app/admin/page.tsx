"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowDownToLine, BellRing, Check, ChevronDown, CircleHelp,
  Eye, FileText, Filter, KeyRound, LayoutDashboard, MapPin, MoreHorizontal,
  PackageCheck, Radio, Search, Settings2, ShieldCheck, Siren, SlidersHorizontal,
  UserPlus, UsersRound, X,
} from "lucide-react";
import { AdminThemeToggle, ProfileDropdown } from "../theme-provider";
import { dashboardPath, getSession, Session } from "../auth";

const FOUND_ITEMS_STORAGE_KEY = "unialert-found-items";

type Claim = { id: string; age: string; initials: string; student: string; identity: string; faculty: string; item: string; detail: string; tone: "red" | "coral" | "teal" };
const claims: Claim[] = [
  { id: "CLM-9942", age: "18m ago", initials: "DK", student: "David Kim", identity: "STU-481902", faculty: "Computer Eng.", item: "MacBook Pro 16\" (Space Gray)", detail: "Locker: Lab-Safe-04 • $2,400 est.", tone: "red" },
  { id: "CLM-9938", age: "42m ago", initials: "AS", student: "Amina Said", identity: "STU-319884", faculty: "Med Bio", item: "Leather Bifold + Government ID", detail: "Locker: Sec-Desk-02 • Contains Cash", tone: "red" },
  { id: "CLM-9921", age: "1h 15m ago", initials: "LR", student: "Lucas Rossi", identity: "STU-772183", faculty: "Architecture", item: "Sony Alpha A7 IV Camera Body", detail: "Locker: Art-Dept-Vault • $2,800 est.", tone: "coral" },
  { id: "CLM-9915", age: "2h 05m ago", initials: "EH", student: "Elena Huang", identity: "FAC-11094", faculty: "Chemistry Faculty", item: "Sub-Master High-Security Lab Keyring", detail: "Lockbox: Hazmat-Safe-1 • Restricted", tone: "coral" },
];
const featureViews: Record<string, { eyebrow: string; title: string; description: string; metrics: string[]; rows: string[] }> = {
  "Student Registry": { eyebrow: "Directory operations", title: "Student Registry", description: "Review verified student identities and account access across the recovery network.", metrics: ["38,420 verified students", "96 active reviews", "98.2% SSO coverage"], rows: ["Maya Chen • maya.chen@university.edu • Applied Science Faculty", "David Kim • david.kim@university.edu • Computer Engineering", "Amina Said • amina.said@university.edu • Medical Biology"] },
  "Moderator Team": { eyebrow: "Staff operations", title: "Moderator Team", description: "Monitor on-duty moderators, permissions, and handoff coverage for active cases.", metrics: ["18 on duty", "4 escalation leads", "100% shift coverage"], rows: ["Officer J. Vargas • Lead Dispatcher • Online", "Priya Nair • Claims Moderator • Reviewing", "Jon Bell • Custody Auditor • Online"] },
  "Lost Reports": { eyebrow: "Property pipeline", title: "Lost Reports", description: "Track open lost-property reports and prioritize cases with strong match signals.", metrics: ["53 open reports", "14 new today", "22 possible matches"], rows: ["LR-2025-0941 • Midnight Blue Leather Backpack • Possible match", "LR-2025-0812 • Apple AirPods Pro • Searching", "LR-2025-0684 • Ti-Nspire Calculator • Awaiting review"] },
  "Found Items": { eyebrow: "Property pipeline", title: "Found Items", description: "Review newly secured property, custody locations, and intake status.", metrics: ["89 secured items", "12 new today", "8 station transfers"], rows: ["FOUND-378300 • Watch • Central Police Center", "FOUND-628377 • iPhone 18 Pro Max • Student Union Desk", "FOUND-410228 • Graphing Calculator • Math Annex"] },
  "Claim Approvals": { eyebrow: "Claims control", title: "Claim Approvals", description: "Authorize verified claims before a physical station handover is released.", metrics: ["7 urgent claims", "4 ready to release", "2 identity checks"], rows: claims.map((claim) => `${claim.id} • ${claim.student} • ${claim.item}`) },
  "Campus Broadcasts": { eyebrow: "Communications", title: "Campus Broadcasts", description: "Manage active campus advisories and monitor delivery across notification channels.", metrics: ["2 live broadcasts", "12,410 delivered", "99.1% delivery rate"], rows: ["Science Quadrangle Access Restriction • Live", "West Gym Theft Prevention Alert • Advisory", "Blue Line Shuttle Diversion • Scheduled"] },
  "Faculties & Depts": { eyebrow: "Campus directory", title: "Faculties & Departments", description: "Maintain campus department contacts and route property notifications to the right teams.", metrics: ["28 departments", "6 escalation groups", "100% contact coverage"], rows: ["Computer Engineering • ICT Research Complex • Active", "Medical Biology • West Science Quad • Active", "Campus Facilities • Central Operations • On call"] },
  "Recovery Stations": { eyebrow: "Custody network", title: "Recovery Stations", description: "Monitor station capacity, opening status, and item handoffs across campus hubs.", metrics: ["8 active hubs", "62% locker capacity", "24h SLA target"], rows: ["Central Police Dispatch • Open • 18 secure lockers", "Library Main Service Desk • Open • 9 secure lockers", "Student Union Information • Open • 6 secure lockers"] },
  "Audit Log & Custody": { eyebrow: "Accountability", title: "Audit Log & Custody", description: "Trace every property movement and administrative action through the custody chain.", metrics: ["1,284 events today", "0 unresolved gaps", "100% signed actions"], rows: ["10:42 • CLM-9942 moved to Lab-Safe-04 • Officer J. Vargas", "10:18 • FOUND-378300 intake verified • Priya Nair", "09:56 • Broadcast #BC-2201 acknowledged • System"] },
  "System Settings": { eyebrow: "Platform controls", title: "System Settings", description: "Configure alert channels, verification rules, custody policies, and administrator access.", metrics: ["12 active policies", "3 channel groups", "Last change 18m ago"], rows: ["Identity verification • Required for claim release • Enabled", "Broadcast approval • Two-person authorization • Enabled", "Custody retention • 180 days • Compliant"] },
};

function AdminFeatureView({ name }: { name: string }) {
  const [exportFormat, setExportFormat] = useState("CSV");
  const [selectedReport, setSelectedReport] = useState<{ report_id: string; item_name: string; description: string; location: string; status: string; created_at: string | null } | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [reportLostOpen, setReportLostOpen] = useState(false);
  const [reportFoundOpen, setReportFoundOpen] = useState(false);
  const [reportFoundSubmitted, setReportFoundSubmitted] = useState(false);
  const [foundReport, setFoundReport] = useState({ title: "", location: "", category: "", description: "", image: "" });
  const [selectedUser, setSelectedUser] = useState<{ name: string; id: string; faculty: string; mode: "details" | "edit" } | null>(null);
  const [claimDecisions, setClaimDecisions] = useState<Record<string, "Approved" | "Denied">>({});

  useEffect(() => {
    setSelectedReport(null);
  }, [name]);

  const view = featureViews[name];
  if (!view) return null;
  const isLostReports = name === "Lost Reports";
  const isFoundItems = name === "Found Items";
  const isStudentRegistry = name === "Student Registry";
  const isClaimApprovals = name === "Claim Approvals";

  const handleFoundImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoundReport((current) => ({ ...current, image: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const submitFoundReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newItem = {
      id: `FOUND-${Date.now().toString().slice(-6)}`,
      ...foundReport,
      submittedBy: "Maya Chen",
      submittedAt: new Date().toISOString(),
    };
    const savedItems = JSON.parse(localStorage.getItem(FOUND_ITEMS_STORAGE_KEY) || "[]");
    localStorage.setItem(FOUND_ITEMS_STORAGE_KEY, JSON.stringify([newItem, ...savedItems]));
    setFoundReport({ title: "", location: "", category: "", description: "", image: "" });
    setReportFoundSubmitted(true);
    window.setTimeout(() => {
      setReportFoundSubmitted(false);
      setReportFoundOpen(false);
    }, 1800);
  };

  const openUserAction = (row: string, mode: "details" | "edit") => {
    const [nameValue, idValue, facultyValue] = row.split(" • ");
    if (!isStudentRegistry) return;
    setSelectedUser({ name: nameValue, id: idValue, faculty: facultyValue, mode });
  };

  const decideClaim = (row: string, decision: "Approved" | "Denied") => {
    setClaimDecisions((current) => ({ ...current, [row]: decision }));
  };

  const openReportDetails = async (row: string) => {
    const reportId = row.split(" • ")[0];
    if (!isLostReports && !isFoundItems) return;

    setSelectedReport({
      report_id: reportId,
      item_name: row.split(" • ")[1] || (isFoundItems ? "Found item" : "Lost property report"),
      description: row.split(" • ").slice(2).join(" • ") || "Loading item details...",
      location: isFoundItems ? row.split(" • ")[2] || "Not recorded" : "Loading...",
      status: isFoundItems ? "Found" : "Loading",
      created_at: null,
    });

    if (isFoundItems) return;

    try {
      const response = await fetch(`http://localhost:8000/api/system/lost-reports/${encodeURIComponent(reportId)}`);
      if (!response.ok) {
        setSelectedReport((current) => current ? { ...current, status: "Unavailable", description: "The report details could not be loaded from the database." } : current);
        return;
      }
      const details = await response.json();
      setSelectedReport(details);
    } catch (error) {
      console.error("Failed to load lost report details", error);
      setSelectedReport((current) => current ? { ...current, status: "Unavailable", description: "The report details could not be loaded from the database." } : current);
    }
  };

  return <div className="admin-feature-view">
    <div className="feature-view-header"><div><div className="eyebrow"><b>{view.eyebrow}</b><span>•</span><span>Admin workspace</span></div><h2>{view.title}</h2><p>{view.description}</p></div><button className="danger-button"><SlidersHorizontal size={15} /> Manage view</button></div>
    <div className="feature-metrics">{view.metrics.map((metric) => <div className="feature-metric" key={metric}><strong>{metric.split(" ")[0]}</strong><span>{metric.slice(metric.indexOf(" ") + 1)}</span></div>)}</div>
    <section className="panel feature-panel"><div className="panel-heading"><div><h2>Active records</h2><p>Operational records requiring moderator attention.</p></div><div className="feature-export-actions">{isLostReports && <button className="white-button" onClick={() => setReportLostOpen(true)}><FileText size={14} /> Report lost item</button>}{isFoundItems && <button className="white-button" onClick={() => setReportFoundOpen(true)}><FileText size={14} /> Report found item</button>}{(isLostReports || isFoundItems) && <label className="export-format"><span>Format</span><select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} aria-label={`${isFoundItems ? "Found items" : "Lost reports"} export format`}><option>CSV</option><option>PDF</option><option>Excel</option></select></label>}{isStudentRegistry && <button className="white-button" onClick={() => setAddUserOpen(true)}><UserPlus size={14} /> Add user</button>}<button className="white-button"><ArrowDownToLine size={14} /> Export view</button></div></div><div className={`feature-records ${isStudentRegistry ? "student-registry-records" : ""}`}>{view.rows.map((row, index) => <div className={`feature-record ${isClaimApprovals ? "claim-approval-record" : ""}`} key={row}><span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span><span>{row}</span>{isStudentRegistry ? <span className="registry-actions"><button aria-label={`Edit user ${index + 1}`} title="Edit user" onClick={() => openUserAction(row, "edit")}><SlidersHorizontal size={15} /></button><button aria-label={`View details for user ${index + 1}`} title="View user details" onClick={() => openUserAction(row, "details")}><Eye size={15} /></button></span> : isClaimApprovals ? <span className="claim-actions">{claimDecisions[row] ? <b className={`claim-decision ${claimDecisions[row].toLowerCase()}`}>{claimDecisions[row]}</b> : <><button className="approve-button" onClick={() => decideClaim(row, "Approved")}>Approve</button><button className="deny-button" onClick={() => decideClaim(row, "Denied")}>Deny</button></>}</span> : <button aria-label={isLostReports || isFoundItems ? `View details for item ${index + 1}` : `Open record ${index + 1}`} title={isLostReports || isFoundItems ? "View details" : undefined} onClick={() => openReportDetails(row)}>{isLostReports || isFoundItems ? <Eye size={17} /> : <MoreHorizontal size={17} />}</button>}</div>)}</div></section>
    {selectedReport && <div className="modal-backdrop" onClick={() => setSelectedReport(null)}><div className="broadcast-modal report-details-modal" role="dialog" aria-modal="true" aria-labelledby="report-details-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedReport(null)} aria-label="Close report details"><X size={18} /></button><div className="eyebrow"><b>Database record</b><span>•</span><span>{selectedReport.status}</span></div><h2 id="report-details-title">{selectedReport.item_name}</h2><p>{selectedReport.description}</p><dl><div><dt>Report ID</dt><dd>{selectedReport.report_id}</dd></div><div><dt>Last known location</dt><dd>{selectedReport.location}</dd></div><div><dt>Reported</dt><dd>{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : "Not recorded"}</dd></div></dl></div></div>}
    {addUserOpen && <div className="modal-backdrop" onClick={() => setAddUserOpen(false)}><div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="add-user-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAddUserOpen(false)} aria-label="Close add user dialog"><X size={18} /></button><div className="eyebrow"><b>Student Registry</b><span>•</span><span>New account</span></div><h2 id="add-user-title">Add user</h2><p>Create a verified student directory record.</p><label className="add-user-field">Full name<input placeholder="e.g. Jordan Lee" /></label><label className="add-user-field">University email<input type="email" placeholder="jordan.lee@university.edu" /></label><label className="add-user-field">Password<input type="password" placeholder="Create a secure password" /></label><label className="add-user-field">Faculty<select defaultValue=""><option value="" disabled>Select faculty</option><option>Applied Science Faculty</option><option>Computer Engineering</option><option>Medical Biology</option></select></label><button className="danger-button add-user-submit" onClick={() => setAddUserOpen(false)}><UserPlus size={14} /> Create user</button></div></div>}
    {reportLostOpen && <div className="modal-backdrop" onClick={() => setReportLostOpen(false)}><div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="report-lost-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setReportLostOpen(false)} aria-label="Close report lost item dialog"><X size={18} /></button><div className="eyebrow"><b>Lost Reports</b><span>•</span><span>New report</span></div><h2 id="report-lost-title">Report lost item</h2><p>Record a lost item for tracking and matching.</p><label className="add-user-field">Item name<input placeholder="e.g. Midnight blue backpack" /></label><label className="add-user-field">Last known location<input placeholder="e.g. West Gym" /></label><label className="add-user-field">Description<textarea placeholder="Add identifying details" /></label><button className="danger-button add-user-submit" onClick={() => setReportLostOpen(false)}><FileText size={14} /> Submit report</button></div></div>}
    {reportFoundOpen && <div className="modal-backdrop" onClick={() => setReportFoundOpen(false)}><div className="broadcast-modal add-user-modal found-admin-modal" role="dialog" aria-modal="true" aria-labelledby="report-found-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setReportFoundOpen(false)} aria-label="Close report found item dialog"><X size={18} /></button><div className="eyebrow"><b>Found Items</b><span>•</span><span>New report</span></div><h2 id="report-found-title">Report a found item</h2><p>Provide enough detail for campus staff to verify, secure, and return the item safely.</p><form onSubmit={submitFoundReport}><label className="add-user-field">Item name<input required value={foundReport.title} onChange={(event) => setFoundReport({ ...foundReport, title: event.target.value })} placeholder="e.g. Black wireless headphones" /></label><label className="add-user-field">Found location<select required value={foundReport.location} onChange={(event) => setFoundReport({ ...foundReport, location: event.target.value })}><option value="">Select campus location</option><option>Main Library Commons</option><option>ICT Engineering Hallway</option><option>Student Union Plaza</option><option>Science Quadrangle</option><option>Recreation Center</option><option>Other campus location</option></select></label><label className="add-user-field">Category<select required value={foundReport.category} onChange={(event) => setFoundReport({ ...foundReport, category: event.target.value })}><option value="">Select category</option><option>Electronics</option><option>Keys &amp; access cards</option><option>Books &amp; math</option><option>Clothing &amp; accessories</option><option>Other</option></select></label><label className="add-user-field">Item photo<input type="file" accept="image/*" onChange={handleFoundImageChange} /><span>{foundReport.image ? "Photo attached" : "Choose a photo from this device"}</span></label>{foundReport.image && <img className="found-image-preview" src={foundReport.image} alt="Preview of found item" />}<label className="add-user-field">Description and distinguishing details<textarea required value={foundReport.description} onChange={(event) => setFoundReport({ ...foundReport, description: event.target.value })} placeholder="Describe color, markings, where it was found, and any safe identifying details." /></label><div className="found-admin-footer"><span>Submitted reports are queued for staff verification.</span><button type="submit" className="danger-button add-user-submit"><FileText size={14} /> {reportFoundSubmitted ? "Submitted" : "Submit found item"}</button></div></form></div></div>}
    {selectedUser && <div className="modal-backdrop" onClick={() => setSelectedUser(null)}><div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="user-action-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedUser(null)} aria-label="Close user dialog"><X size={18} /></button><div className="eyebrow"><b>Student Registry</b><span>•</span><span>{selectedUser.mode === "edit" ? "Edit account" : "User details"}</span></div><h2 id="user-action-title">{selectedUser.mode === "edit" ? "Edit user" : selectedUser.name}</h2>{selectedUser.mode === "details" ? <dl className="user-details-list"><div><dt>University email</dt><dd>{selectedUser.id}</dd></div><div><dt>Faculty</dt><dd>{selectedUser.faculty}</dd></div><div><dt>Status</dt><dd>Verified</dd></div></dl> : <><label className="add-user-field">Full name<input defaultValue={selectedUser.name} /></label><label className="add-user-field">University email<input type="email" defaultValue={selectedUser.id} /></label><label className="add-user-field">Faculty<input defaultValue={selectedUser.faculty} /></label><button className="danger-button add-user-submit" onClick={() => setSelectedUser(null)}><Check size={14} /> Save changes</button></>}</div></div>}
  </div>;
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [activeNav, setActiveNav] = useState("Overview & Triage");
  const [claimFilter, setClaimFilter] = useState("All Risk Tiers");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [search, setSearch] = useState("");
  const [adminNotifications, setAdminNotifications] = useState<Array<{ claim_id: string; student_name: string; item_name: string; created_at: string | null; status: string }>>([]);
  const [itemSummary, setItemSummary] = useState({ found_items: 89, lost_items: 53 });
  const [feedRefresh, setFeedRefresh] = useState(0);

  useEffect(() => {
    const session = getSession();
    if (!session) router.replace("/signin");
    else if (session.role !== "moderator") router.replace(dashboardPath(session.role));
    else setSession(session);
  }, [router]);
  const moderatorName = session ? `${session.firstName} ${session.lastName}` : "Faculty Moderator";
  const moderatorInitials = session ? `${session.firstName[0] || ""}${session.lastName[0] || ""}`.toUpperCase() : "FM";

  const navSections: Array<{ label: string; items: Array<[string, typeof Search | typeof PackageCheck | typeof KeyRound | typeof LayoutDashboard | typeof UsersRound | typeof ShieldCheck, string, string]> }> = [
    { label: "Console Navigation", items: [["Overview & Triage", LayoutDashboard, "", "active"], ["Student Registry", UsersRound, "38.4k", ""], ["Moderator Team", ShieldCheck, "18 On-duty", ""]] },
    { label: "Property Pipeline", items: [["Lost Reports", Search, String(itemSummary.lost_items), ""], ["Found Items", PackageCheck, String(itemSummary.found_items), ""], ["Claim Approvals", KeyRound, "7 Urgent", "urgent"]] },
  ];
  navSections[0].items = navSections[0].items.filter(([label]) => label !== "Moderator Team");

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/system/admin-notifications");
        if (!response.ok) return;
        const data = await response.json();
        setAdminNotifications(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        console.error("Failed to load live notifications", error);
      }
    };

    const loadItemSummary = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/system/item-summary");
        if (!response.ok) return;
        const data = await response.json();
        if (data && typeof data === "object") {
          setItemSummary({
            found_items: Number(data.found_items ?? 0),
            lost_items: Number(data.lost_items ?? 0),
          });
        }
      } catch (error) {
        console.error("Failed to load item summary", error);
      }
    };

    loadNotifications();
    loadItemSummary();
    const intervalId = window.setInterval(() => {
      loadNotifications();
      loadItemSummary();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [feedRefresh]);

  const filteredClaims = claims.filter((claim) => `${claim.id} ${claim.student} ${claim.item}`.toLowerCase().includes(search.toLowerCase()) && (claimFilter === "All Risk Tiers" || (claimFilter === "Immediate" ? claim.tone === "red" : claim.tone !== "red")));

  return <div className="admin-shell">
    <header className="topbar"><div className="topbar-brand"><span className="mini-mark"><ShieldCheck size={14} /></span><span><b>UniAlert</b><small>Administrator Portal</small></span></div><div className="topbar-context"><ShieldCheck size={14} /> Campus Safety &amp; Property Recovery Service</div><div className="topbar-actions"><label className="global-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case ID, items..." /></label><button className="icon-button" aria-label="Notifications"><BellRing size={16} />{adminNotifications.length > 0 && <i>{adminNotifications.length}</i>}</button><button className="beacon-button" onClick={() => setBroadcastOpen(true)}><Siren size={14} /> Emergency Beacon</button><ProfileDropdown name={moderatorName} initials={moderatorInitials} role="Faculty Moderator" summary="Campus property and claim operations" email={session?.email || ""} /></div><AdminThemeToggle /></header>
    <main className="dashboard"><div className="workspace"><aside className="console-rail"><div className="rail-profile"><span className="rail-profile-avatar">{moderatorInitials}</span><span><b>{moderatorName}</b><small>Faculty Moderator</small></span><i>Online</i></div><div className="rail-card"><div className="rail-title"><span>Console Navigation</span><b>v4.2.8</b></div>{navSections.map((section) => <div className="rail-section" key={section.label}><small>{section.label}</small>{section.items.map(([label, Icon, count, state]) => <button key={label} className={`rail-link ${activeNav === label ? "current" : ""} ${state}`} onClick={() => setActiveNav(label)}><span><Icon size={14} /> {label}</span>{count && <b>{count}</b>}</button>)}</div>)}</div></aside>
      <section className="content-stage">{activeNav === "Overview & Triage" && <div className="page-heading"><div><div className="eyebrow"><b>SecOps Central Command</b><span>•</span><span>Real-Time Dispatch Synced</span></div><h1>Faculty Moderator &amp; Property Command</h1><p>Live telemetry, custody audit trails, and student asset reunification protocols.</p></div></div>}
        {activeNav === "Overview & Triage" && adminNotifications.length > 0 && <div className="notification-stack">
          {adminNotifications.map((notification) => <div className="notification-item" key={notification.claim_id}><span className="notification-dot" /><div><strong>{notification.claim_id}</strong><small>{notification.student_name} • {notification.item_name}</small><time>{notification.created_at ? new Date(notification.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}</time></div></div>)}
        </div>}
        {activeNav === "Overview & Triage" ? <>
        <div className="broadcast-banner"><div className="broadcast-icon"><BellRing size={17} /></div><div><div className="banner-label">CRITICAL BROADCAST ACTIVE (2/2) <span>Broadcasted via Push Notification, Email &amp; Hall Display Totems</span></div><p>Science Quadrangle Access Restriction • Building B Maintenance Lock • Expect rerouting near North Gate</p></div><div className="banner-actions"><b>12,410 Delivered</b><button onClick={() => setBroadcastOpen(true)}>Manage Feeds</button></div></div>
        <div className="kpi-grid">{[["Student Registry", "38,420", "98.2% SSO Verified", ShieldCheck, "good"], ["Lost Reports", String(itemSummary.lost_items), "Open and tracked", Search, "blue"], ["Found Items", String(itemSummary.found_items), "Verified & secured", PackageCheck, "neutral"], ["Pending Claims", "7", "Physical ID check required", AlertTriangle, "bad"], ["Campus Advisories", "2", "Live broadcasts active", BellRing, "bad"], ["Reunification Rate", "91.3%", "+4.2% semester goal", Check, "good"]].map(([label, value, note, Icon, tone]) => <article className="kpi-card" key={label as string}><div><span>{label as string}</span><Icon size={15} className={tone as string} /></div><strong className={tone as string}>{value as string}</strong><small className={tone as string}>{note as string}</small></article>)}</div>
        <div className="analytics-grid"><article className="panel trend-panel"><div className="panel-heading"><div><h2>Lost vs. Found Volume &amp; Recovery Trends</h2><p>Real-time intake tracking and automated matching.</p></div><div className="chart-legend"><span className="legend-found">Found <b>(342)</b></span><span className="legend-lost">Lost <b>(284)</b></span><span className="legend-reunified">Reunified <b>(312)</b></span></div></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /></div><div className="bars">{[55, 42, 68, 48, 78, 59, 86].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div><svg viewBox="0 0 500 160" preserveAspectRatio="none" aria-label="Recovery trend line"><path d="M0 125 C70 93, 100 132, 165 104 S260 116, 320 75 S405 86, 500 34" /></svg></div><div className="chart-labels"><span>Week 38</span><span>Week 39</span><span>Week 40</span><span>Week 41</span><span>Week 42</span><b>Week 43 (Live)</b></div></article><article className="panel hotspot-panel"><div className="panel-heading"><div><h2>Intake Hotspots</h2><p>Top high-incident recovery locations across campus hubs.</p></div><MapPin size={15} /></div>{[["W.E.B. Central Library", "34%", "31 items"], ["ICT Research Complex", "22%", "20 items"], ["Student Union Plaza", "18%", "16 items"], ["Sports & Aquatics Arena", "14%", "12 items"], ["North Commons Cafeteria", "12%", "10 items"]].map(([name, percent, total]) => <div className="hotspot" key={name}><div><span>{name}</span><b>{percent}</b></div><div className="progress"><i style={{ width: percent }} /></div><small>{total}</small></div>)}<footer>Locker capacity <b>62% Occupied</b></footer></article><article className="panel pie-chart-panel"><div className="panel-heading"><div><h2>Claim Resolution</h2><p>Time-to-return chain-of-custody efficiency.</p></div><span className="optimal">Optimal</span></div><div className="sla-chart" aria-label="Claim resolution pie chart"><div className="sla-pie"><div className="sla-pie-center"><strong>72%</strong><small>On Time</small></div></div></div><div className="sla-copy"><span><b>On-time claims</b><strong>72%</strong></span><span><b>Escalations</b><strong>18%</strong></span><span><b>Delayed</b><strong>10%</strong></span></div></article></div>
        <section className="panel queue-panel"><div className="queue-header"><div className="queue-title"><span className="queue-icon"><KeyRound size={17} /></span><div><div className="section-kicker">High-value claim review</div><h2>High-Value Claim Verification Queue</h2><p>Claims for high-tier assets require moderator authorization before physical station handover.</p></div><b className="immediate-badge">7 Immediate Action Required</b></div><div className="queue-tools"><label><Filter size={13} /><select value={claimFilter} onChange={(event) => setClaimFilter(event.target.value)}><option>All Risk Tiers</option><option>Immediate</option><option>Review</option></select><ChevronDown size={13} /></label><button onClick={() => { setSearch(""); setFeedRefresh((current) => current + 1); }}><SlidersHorizontal size={13} /> Refresh Feed</button></div></div><div className="claim-table"><div className="table-head"><span>CLAIM ID</span><span>STUDENT / ID</span><span>ITEM SPEC &amp; CUSTODY</span><span /></div>{filteredClaims.map((claim) => <div className="claim-row" key={claim.id}><div><b className={`risk-dot ${claim.tone}`} /> <strong>{claim.id}</strong><small>Logged {claim.age}</small></div><div className="student"><span className={`initials ${claim.tone}`}>{claim.initials}</span><span><b>{claim.student}</b><small>{claim.identity} • {claim.faculty}</small></span></div><div className="item-summary"><span className="item-thumb"><PackageCheck size={14} /></span><span><b>{claim.item}</b><small>{claim.detail}</small></span></div><button className="row-menu" aria-label={`More options for ${claim.id}`}><MoreHorizontal size={17} /></button></div>)}{filteredClaims.length === 0 && <div className="empty-state">No claims match this filter.</div>}<footer className="table-footer"><span>Showing {filteredClaims.length} of 7 high-risk priority claims</span><div><button>Previous</button><b>1</b><button>2</button><button>Next</button></div></footer></div></section>
        <section className="panel composer" id="quick-broadcast-box"><div className="composer-heading"><span className="queue-icon"><Radio size={17} /></span><div><div className="section-kicker">Issue urgent campus alert</div><h2>Broadcast Composer</h2><p>Deploy immediate multi-channel advisories to student mobile push, university emails, and public signage in 3 clicks.</p></div><span className="fast-publish">FAST-PUBLISH SYSTEM</span></div><div className="composer-body"><div className="severity"><span>1. Select Severity Level</span><div><button className="selected"><CircleHelp size={14} /> Advisory</button><button><AlertTriangle size={14} /> Urgent Warning</button><button><X size={14} /> Lockdown / Evac</button></div><label>Quick Template Preload <select><option>Custom Manual Preload</option><option>Severe Weather</option><option>Building Closure</option></select></label></div><div className="message-field"><span>2. Alert Headline &amp; Push Copy</span><input defaultValue="Caution: Science Quadrangle Access Restriction" /><textarea defaultValue="Maintenance crew dispatched for transformer inspection. Please defer pedestrian traffic around North Gate." /><div className="channel-checks"><label><input type="checkbox" defaultChecked /> Push Notification</label><label><input type="checkbox" defaultChecked /> Campus Email Blast</label><label><input type="checkbox" defaultChecked /> Hall LED Displays</label></div></div><div className="authorize"><span>3. Authorization</span><p>Signed as: Officer J. Vargas (Lead Dispatcher)</p><small>Audit Hash: #AUTH-991204</small><button onClick={() => setBroadcastSent(true)}><Check size={15} /> Authorize &amp; Transmit</button>{broadcastSent && <b className="sent-message">Broadcast queued for dispatch.</b>}</div></div></section>
      </> : <AdminFeatureView name={activeNav} />}
      </section></div></main>
    {broadcastOpen && <div className="modal-backdrop"><div className="broadcast-modal" role="dialog" aria-modal="true" aria-labelledby="broadcast-title"><button className="modal-close" onClick={() => setBroadcastOpen(false)} aria-label="Close"><X size={18} /></button><Siren size={22} className="modal-icon" /><h2 id="broadcast-title">Emergency broadcast control</h2><p>The active feed is currently reaching 12,410 recipients across push, email, and hall displays.</p><button className="danger-button" onClick={() => { setBroadcastSent(true); setBroadcastOpen(false); }}><Radio size={15} /> Confirm dispatch</button></div></div>}
  </div>;
}