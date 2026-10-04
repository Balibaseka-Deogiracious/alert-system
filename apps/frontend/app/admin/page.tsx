"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, BellRing, Check, ChevronDown, CircleHelp,
  Eye, FileText, Filter, KeyRound, LayoutDashboard, MapPin, MoreHorizontal,
  PackageCheck, Radio, Search, Settings2, ShieldCheck, Siren, SlidersHorizontal,
  UserPlus, UsersRound, X,
} from "lucide-react";
import { getSession } from "../auth";
import { AdminThemeToggle, ProfileDropdown } from "../theme-provider";

const FOUND_ITEMS_STORAGE_KEY = "unialert-found-items";

type Claim = { id: string; age: string; initials: string; student: string; identity: string; faculty: string; item: string; category: string; detail: string; tone: "red" | "coral" | "teal" };
type SelectedReport = { report_id: string; item_name: string; description: string; location: string; status: string; created_at: string | null; category?: string };
const claims: Claim[] = [
  { id: "CLM-9942", age: "18m ago", initials: "DK", student: "David Kim", identity: "STU-481902", faculty: "Computer Eng.", item: "MacBook Pro 16\" (Space Gray)", category: "Electronics", detail: "Locker: Lab-Safe-04 • $2,400 est.", tone: "red" },
  { id: "CLM-9938", age: "42m ago", initials: "AS", student: "Amina Said", identity: "STU-319884", faculty: "Med Bio", item: "Leather Bifold + Government ID", category: "Accessories", detail: "Locker: Sec-Desk-02 • Contains Cash", tone: "red" },
  { id: "CLM-9921", age: "1h 15m ago", initials: "LR", student: "Lucas Rossi", identity: "STU-772183", faculty: "Architecture", item: "Sony Alpha A7 IV Camera Body", category: "Electronics", detail: "Locker: Art-Dept-Vault • $2,800 est.", tone: "coral" },
  { id: "CLM-9915", age: "2h 05m ago", initials: "EH", student: "Elena Huang", identity: "FAC-11094", faculty: "Chemistry Faculty", item: "Sub-Master High-Security Lab Keyring", category: "Keys & access cards", detail: "Lockbox: Hazmat-Safe-1 • Restricted", tone: "coral" },
];
const featureViews: Record<string, { eyebrow: string; title: string; description: string; metrics: string[]; rows: string[] }> = {
  "User Registry": { eyebrow: "", title: "User Registry", description: "Review verified user identities and account access across the recovery network.", metrics: ["38,420 verified users", "96 active reviews", "98.2% total users"], rows: ["Maya Chen • maya.chen@university.edu • Applied Science Faculty", "David Kim • david.kim@university.edu • Computer Engineering", "Amina Said • amina.said@university.edu • Medical Biology"] },
  "Moderator Team": { eyebrow: "Staff operations", title: "Moderator Team", description: "Monitor on-duty moderators, permissions, and handoff coverage for active cases.", metrics: ["18 on duty", "4 escalation leads", "100% shift coverage"], rows: ["Officer J. Vargas • Lead Dispatcher • Online", "Priya Nair • Claims Moderator • Reviewing", "Jon Bell • Custody Auditor • Online"] },
  "Lost Reports": { eyebrow: "Property pipeline", title: "Lost Reports", description: "Track open lost-property reports and prioritize cases with strong match signals.", metrics: ["53 open reports", "14 new today", "22 possible matches"], rows: ["LR-2025-0941 • Midnight Blue Leather Backpack • Possible match", "LR-2025-0812 • Apple AirPods Pro • Searching", "LR-2025-0684 • Ti-Nspire Calculator • Awaiting review"] },
  "Found Items": { eyebrow: "Property pipeline", title: "Found Items", description: "Review newly secured property, custody locations, and intake status.", metrics: ["89 secured items", "12 new today", "89 total items"], rows: ["FOUND-378300 • Watch • Electronics • Central Police Center", "FOUND-628377 • iPhone 18 Pro Max • Electronics • Student Union Desk", "FOUND-410228 • Graphing Calculator • Books & math • Math Annex"] },
  "Claim Approvals": { eyebrow: "Claims control", title: "Claim Approvals", description: "Authorize verified claims before a physical station handover is released.", metrics: ["7 urgent claims", "4 ready to release", "2 identity checks"], rows: claims.map((claim) => `${claim.id} • ${claim.student} • ${claim.item} • ${claim.category}`) },
  "Campus Broadcasts": { eyebrow: "Communications", title: "Campus Broadcasts", description: "Manage active campus advisories and monitor delivery across notification channels.", metrics: ["2 live broadcasts", "12,410 delivered", "99.1% delivery rate"], rows: ["Science Quadrangle Access Restriction • Live", "West Gym Theft Prevention Alert • Advisory", "Blue Line Shuttle Diversion • Scheduled"] },
  "Faculties & Depts": { eyebrow: "Campus directory", title: "Faculties & Departments", description: "Maintain campus department contacts and route property notifications to the right teams.", metrics: ["28 departments", "6 escalation groups", "100% contact coverage"], rows: ["Computer Engineering • ICT Research Complex • Active", "Medical Biology • West Science Quad • Active", "Campus Facilities • Central Operations • On call"] },
  "Recovery Stations": { eyebrow: "Custody network", title: "Recovery Stations", description: "Monitor station capacity, opening status, and item handoffs across campus hubs.", metrics: ["8 active hubs", "62% locker capacity", "24h SLA target"], rows: ["Central Police Dispatch • Open • 18 secure lockers", "Library Main Service Desk • Open • 9 secure lockers", "Student Union Information • Open • 6 secure lockers"] },
  "Audit Log & Custody": { eyebrow: "Accountability", title: "Audit Log & Custody", description: "Trace every property movement and administrative action through the custody chain.", metrics: ["1,284 events today", "0 unresolved gaps", "100% signed actions"], rows: ["10:42 • CLM-9942 moved to Lab-Safe-04 • Officer J. Vargas", "10:18 • FOUND-378300 intake verified • Priya Nair", "09:56 • Broadcast #BC-2201 acknowledged • System"] },
  "System Settings": { eyebrow: "Platform controls", title: "System Settings", description: "Configure alert channels, verification rules, custody policies, and administrator access.", metrics: ["12 active policies", "3 channel groups", "Last change 18m ago"], rows: ["Identity verification • Required for claim release • Enabled", "Broadcast approval • Two-person authorization • Enabled", "Custody retention • 180 days • Compliant"] },
};

const NAV_SECTION_MAP: Record<string, string> = {
  "Overview & Triage": "overview-and-triage",
  "User Registry": "user-registry",
  "Lost Reports": "lost-reports",
  "Found Items": "found-items",
  "Claim Approvals": "claim-approvals",
};

function AdminFeatureView({ name }: { name: string }) {
  const [exportFormat, setExportFormat] = useState("CSV");
  const [selectedReport, setSelectedReport] = useState<SelectedReport | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [reportLostOpen, setReportLostOpen] = useState(false);
  const [reportLostMode, setReportLostMode] = useState<"create" | "edit">("create");
  const [editingLostReportIndex, setEditingLostReportIndex] = useState<number | null>(null);
  const [reportFoundOpen, setReportFoundOpen] = useState(false);
  const [reportFoundSubmitted, setReportFoundSubmitted] = useState(false);
  const [foundReport, setFoundReport] = useState({ title: "", location: "", category: "", description: "", image: "" });
  const [newLostReport, setNewLostReport] = useState({ reportId: "", itemName: "", location: "", description: "", status: "Possible match" });
  const [selectedUser, setSelectedUser] = useState<{ name: string; id: string; faculty: string; mode: "details" | "edit" } | null>(null);
  const [claimDecisions, setClaimDecisions] = useState<Record<string, "Approved" | "Denied">>({});
  const [lostReportRows, setLostReportRows] = useState<string[]>(featureViews["Lost Reports"].rows);

  useEffect(() => {
    setSelectedReport(null);
  }, [name]);

  const view = featureViews[name];
  if (!view) return null;
  const isLostReports = name === "Lost Reports";
  const isFoundItems = name === "Found Items";
  const isUserRegistry = name === "User Registry";
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
    if (!isUserRegistry) return;
    setSelectedUser({ name: nameValue, id: idValue, faculty: facultyValue, mode });
  };

  const tableRows = isLostReports ? lostReportRows : view.rows;

  const handleLostReportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reportId = newLostReport.reportId.trim() || `LR-${Date.now().toString().slice(-6)}`;
    const itemName = newLostReport.itemName.trim() || "Unnamed item";
    const status = newLostReport.status.trim() || "Possible match";
    const nextRow = `${reportId} • ${itemName} • ${status}`;

    if (reportLostMode === "edit" && editingLostReportIndex !== null) {
      setLostReportRows((current) => current.map((row, index) => index === editingLostReportIndex ? nextRow : row));
    } else {
      setLostReportRows((current) => [nextRow, ...current]);
    }

    closeLostReportModal();
  };

  const openLostReportAction = (row: string, mode: "view" | "edit", index: number) => {
    const [reportIdValue, itemValue, statusValue] = row.split(" • ");
    if (mode === "view") {
      openReportDetails(row);
      return;
    }

    setReportLostMode("edit");
    setEditingLostReportIndex(index);
    setNewLostReport({
      reportId: reportIdValue || "",
      itemName: itemValue || "",
      location: "",
      description: "",
      status: statusValue || "Possible match",
    });
    setReportLostOpen(true);
  };

  const decideClaim = (row: string, decision: "Approved" | "Denied") => {
    setClaimDecisions((current) => ({ ...current, [row]: decision }));
  };

  const openReportDetails = async (row: string) => {
    const reportId = row.split(" • ")[0];
    if (!isLostReports && !isFoundItems) return;

    if (isFoundItems) {
      const [, itemName, category, location] = row.split(" • ");
      setSelectedReport({
        report_id: reportId,
        item_name: itemName || "Found item",
        description: "Detailed description will appear here",
        location: location || "Not recorded",
        status: "Found",
        created_at: null,
        category: category || "Not recorded",
      });
      return;
    }

    setSelectedReport({
      report_id: reportId,
      item_name: row.split(" • ")[1] || "Lost property report",
      description: row.split(" • ").slice(2).join(" • ") || "Loading item details...",
      location: "Loading...",
      status: "Loading",
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

  const metricCards = name === "User Registry" ? [
    { label: "Verified users", value: "38,420", icon: ShieldCheck },
    { label: "Active reviews", value: "96", icon: UsersRound },
    { label: "Total users", value: "98.2%", icon: Search },
  ] : view.metrics.map((metric, index) => {
    const [value, ...labelParts] = metric.split(" ");
    return { label: labelParts.join(" "), value, icon: [ShieldCheck, UsersRound, Search][index % 3] };
  });

  const featureActionLabel = isLostReports ? "Report lost item" : isFoundItems ? "Report found item" : isClaimApprovals ? "" : "Add user";
  const openFeatureAction = () => {
    if (isClaimApprovals) return;
    if (isLostReports) {
      setReportLostMode("create");
      setEditingLostReportIndex(null);
      setNewLostReport({ reportId: "", itemName: "", location: "", description: "", status: "Possible match" });
      setReportLostOpen(true);
      return;
    }
    if (isFoundItems) {
      setReportFoundOpen(true);
      return;
    }
    setAddUserOpen(true);
  };

  const closeLostReportModal = () => {
    setReportLostOpen(false);
    setReportLostMode("create");
    setEditingLostReportIndex(null);
    setNewLostReport({ reportId: "", itemName: "", location: "", description: "", status: "Possible match" });
  };

  return (
    <div className="admin-feature-view">
      <div className="feature-view-header">
        <div>
          {view.eyebrow ? <div className="eyebrow"><b>{view.eyebrow}</b></div> : null}
          <h2>{view.title}</h2>
          <p>{view.description}</p>
        </div>
        {!isClaimApprovals && (
          <button className="danger-button" onClick={openFeatureAction}>
            {isLostReports ? <FileText size={15} /> : <UserPlus size={15} />}
            {featureActionLabel}
          </button>
        )}
      </div>

      <div className="feature-metrics">
        {metricCards.map(({ label, value }) => (
          <div className="feature-metric" key={label}>
            <div className="metric-label-row">
              <span>{label}</span>
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="panel feature-panel">
        <div className="panel-heading">
          <div>
            <h2>Active records</h2>
            <p>Operational records requiring moderator attention.</p>
          </div>

          <div className="feature-export-actions">
            {isLostReports && (
              <div className="export-button-group">
                <button className="export-button primary-button" type="button">PDF</button>
                <button className="export-button primary-button" type="button">CSV</button>
                <button className="export-button primary-button" type="button">Excel</button>
              </div>
            )}
            {isUserRegistry ? (
              <span className="table-actions-label">Actions</span>
            ) : null}
          </div>
        </div>

        {isClaimApprovals && (
          <div className="registry-table-header claim-approvals-table-header">
            <span>№</span>
            <span>Claim ID</span>
            <span>Name</span>
            <span>Item Name</span>
            <span>Category</span>
            <span>Actions</span>
          </div>
        )}

        {(isUserRegistry || isLostReports || isFoundItems) && (
          <div className={`registry-table-header ${isLostReports || isFoundItems ? isFoundItems ? "found-items-table-header" : "lost-report-table-header" : ""}`}>
            <span>№</span>
            <span>{isUserRegistry ? "Name" : isFoundItems ? "Item ID" : "Report ID"}</span>
            <span>{isUserRegistry ? "Email" : "Item"}</span>
            {isFoundItems && <span>Category</span>}
            <span>{isUserRegistry ? "Faculty" : isFoundItems ? "Location" : "Status"}</span>
            {isLostReports && <span>Status</span>}
            <span>Actions</span>
          </div>
        )}

        <div className={`feature-records ${isUserRegistry || isLostReports || isFoundItems || isClaimApprovals ? "student-registry-records" : ""}`}>
          {tableRows.map((row, index) => {
            if (isUserRegistry) {
              const [nameValue, emailValue, facultyValue] = row.split(" • ");
              const name = nameValue || "Unknown user";
              const email = emailValue || "unassigned@university.edu";
              const faculty = facultyValue || "General campus access";

              return (
                <div className="feature-record" key={`${name}-${index}`}>
                  <span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="registry-user-fields">
                    <div className="registry-detail-column"><strong>{name}</strong></div>
                    <div className="registry-detail-column"><strong>{email}</strong></div>
                    <div className="registry-detail-column"><strong>{faculty}</strong></div>
                    <div className="registry-status-badge verified">Verified</div>
                  </div>
                  <span className="registry-actions">
                    <button aria-label={`Edit user ${index + 1}`} title="Edit user" onClick={() => openUserAction(row, "edit")}>
                      <SlidersHorizontal size={15} />
                    </button>
                    <button aria-label={`View details for user ${index + 1}`} title="View user details" onClick={() => openUserAction(row, "details")}>
                      <Eye size={15} />
                    </button>
                  </span>
                </div>
              );
            }

            if (isLostReports) {
              const [reportIdValue, itemValue, statusValue] = row.split(" • ");
              const reportId = reportIdValue || "LR-000000";
              const itemName = itemValue || "Unnamed item";
              const status = statusValue || "Possible match";

              return (
                <div className="feature-record" key={`${reportId}-${index}`}>
                  <span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="registry-user-fields lost-report-fields">
                    <div className="registry-detail-column"><strong>{reportId}</strong></div>
                    <div className="registry-detail-column"><strong>{itemName}</strong></div>
                    <div className="registry-detail-column"><strong>{status}</strong></div>
                  </div>
                  <span className="registry-actions">
                    <button className="table-action-button" aria-label={`Edit lost report ${index + 1}`} title="Edit lost report" onClick={() => openLostReportAction(row, "edit", index)}>
                      <SlidersHorizontal size={15} />
                    </button>
                    <button className="table-action-button table-action-button-secondary" aria-label={`View lost report ${index + 1}`} title="View lost report" onClick={() => openLostReportAction(row, "view", index)}>
                      <Eye size={15} />
                    </button>
                  </span>
                </div>
              );
            }

            if (isFoundItems) {
              const [foundIdValue, itemValue, categoryValue, locationValue] = row.split(" • ");
              const foundId = foundIdValue || "FOUND-000000";
              const itemName = itemValue || "Unknown item";
              const category = categoryValue || "Not recorded";
              const location = locationValue || "Not recorded";

              return (
                <div className="feature-record" key={`${foundId}-${index}`}>
                  <span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="registry-user-fields lost-report-fields found-items-fields">
                    <div className="registry-detail-column"><strong>{foundId}</strong></div>
                    <div className="registry-detail-column"><strong>{itemName}</strong></div>
                    <div className="registry-detail-column"><strong>{category}</strong></div>
                    <div className="registry-detail-column"><strong>{location}</strong></div>
                  </div>
                  <span className="registry-actions">
                    <button className="table-action-button table-action-button-secondary" aria-label={`View found item ${index + 1}`} title="View found item" onClick={() => openReportDetails(row)}>
                      <Eye size={15} />
                    </button>
                  </span>
                </div>
              );
            }

            if (isClaimApprovals) {
              const [claimIdValue, nameValue, itemValue, categoryValue] = row.split(" • ");
              const claimId = claimIdValue || "CLM-0000";
              const name = nameValue || "Unknown student";
              const itemName = itemValue || "Unnamed item";
              const category = categoryValue || "Uncategorized";

              return (
                <div className="feature-record claim-approval-record" key={`${claimId}-${index}`}>
                  <span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="claim-approval-fields">
                    <div className="registry-detail-column"><strong>{claimId}</strong></div>
                    <div className="registry-detail-column"><strong>{name}</strong></div>
                    <div className="registry-detail-column"><strong>{itemName}</strong></div>
                    <div className="registry-detail-column"><strong>{category}</strong></div>
                  </div>
                  <span className="claim-actions">
                    {claimDecisions[row] ? (
                      <b className={`claim-decision ${claimDecisions[row].toLowerCase()}`}>{claimDecisions[row]}</b>
                    ) : (
                      <>
                        <button className="approve-button" onClick={() => decideClaim(row, "Approved")}>
                          Approve
                        </button>
                        <button className="deny-button" onClick={() => decideClaim(row, "Denied")}>
                          Deny
                        </button>
                      </>
                    )}
                  </span>
                </div>
              );
            }

            return (
              <div className="feature-record" key={row}>
                <span className="feature-record-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{row}</span>
                <button
                  aria-label={isLostReports || isFoundItems ? `View details for item ${index + 1}` : `Open record ${index + 1}`}
                  title={isLostReports || isFoundItems ? "View details" : undefined}
                  onClick={() => openReportDetails(row)}
                >
                  {isLostReports || isFoundItems ? <Eye size={17} /> : <MoreHorizontal size={17} />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {selectedReport && (
        <div className="modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="broadcast-modal report-details-modal" role="dialog" aria-modal="true" aria-labelledby="report-details-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedReport(null)} aria-label="Close report details"><X size={18} /></button>
            <div className="eyebrow"><b>{isFoundItems ? "Found Item" : "Lost Report"} Details</b><span>•</span><span>{selectedReport.status}</span></div>
            <dl>
              <div><dt>{isFoundItems ? "Item ID" : "Report ID"}</dt><dd>{selectedReport.report_id}</dd></div>
              <div><dt>Item Name</dt><dd>{selectedReport.item_name}</dd></div>
              {isFoundItems && selectedReport.category && <div><dt>Category</dt><dd>{selectedReport.category}</dd></div>}
              {!isFoundItems && <div><dt>Status</dt><dd>{selectedReport.status}</dd></div>}
              <div><dt>{isFoundItems ? "Custody Location" : "Last Known Location"}</dt><dd>{selectedReport.location}</dd></div>
              <div><dt>Description</dt><dd>{selectedReport.description}</dd></div>
              <div><dt>{isFoundItems ? "Found Date" : "Reported Date"}</dt><dd>{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : "Not recorded"}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {addUserOpen && (
        <div className="modal-backdrop" onClick={() => setAddUserOpen(false)}>
          <div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="add-user-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAddUserOpen(false)} aria-label="Close add user dialog"><X size={18} /></button>
            <div className="eyebrow"><b>User Registry</b><span>•</span><span>New account</span></div>
            <h2 id="add-user-title">Add user</h2>
            <p>Create a verified user directory record.</p>
            <label className="add-user-field">Full name<input placeholder="e.g. Jordan Lee" /></label>
            <label className="add-user-field">University email<input type="email" placeholder="jordan.lee@university.edu" /></label>
            <label className="add-user-field">Password<input type="password" placeholder="Create a secure password" /></label>
            <label className="add-user-field">Faculty<select defaultValue=""><option value="" disabled>Select faculty</option><option>Applied Science Faculty</option><option>Computer Engineering</option><option>Medical Biology</option></select></label>
            <button className="danger-button add-user-submit" onClick={() => setAddUserOpen(false)}><UserPlus size={14} /> Create user</button>
          </div>
        </div>
      )}

      {reportLostOpen && (
        <div className="modal-backdrop" onClick={closeLostReportModal}>
          <div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="report-lost-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeLostReportModal} aria-label="Close report lost item dialog"><X size={18} /></button>
            <div className="eyebrow"><b>Lost Reports</b><span>•</span><span>{reportLostMode === "edit" ? "Edit report" : "New report"}</span></div>
            <h2 id="report-lost-title">{reportLostMode === "edit" ? "Edit lost item" : "Report lost item"}</h2>
            <p>{reportLostMode === "edit" ? "Update the report details and current review status." : "Record a lost item for tracking and matching."}</p>
            <form onSubmit={handleLostReportSubmit}>
              <label className="add-user-field">Report ID<input value={newLostReport.reportId} onChange={(event) => setNewLostReport((current) => ({ ...current, reportId: event.target.value }))} placeholder="e.g. LR-2025-0955" /></label>
              <label className="add-user-field">Item name<input required value={newLostReport.itemName} onChange={(event) => setNewLostReport((current) => ({ ...current, itemName: event.target.value }))} placeholder="e.g. Midnight blue backpack" /></label>
              <label className="add-user-field">Last known location<input value={newLostReport.location} onChange={(event) => setNewLostReport((current) => ({ ...current, location: event.target.value }))} placeholder="e.g. West Gym" /></label>
              <label className="add-user-field">Status<select value={newLostReport.status} onChange={(event) => setNewLostReport((current) => ({ ...current, status: event.target.value }))}><option>Possible match</option><option>Searching</option><option>Awaiting review</option><option>Recovered</option></select></label>
              <label className="add-user-field">Description<textarea value={newLostReport.description} onChange={(event) => setNewLostReport((current) => ({ ...current, description: event.target.value }))} placeholder="Add identifying details" /></label>
              <button type="submit" className="danger-button add-user-submit"><FileText size={14} /> {reportLostMode === "edit" ? "Save changes" : "Submit report"}</button>
            </form>
          </div>
        </div>
      )}

      {reportFoundOpen && (
        <div className="modal-backdrop" onClick={() => setReportFoundOpen(false)}>
          <div className="broadcast-modal add-user-modal found-admin-modal" role="dialog" aria-modal="true" aria-labelledby="report-found-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setReportFoundOpen(false)} aria-label="Close report found item dialog"><X size={18} /></button>
            <div className="eyebrow"><b>Found Items</b><span>•</span><span>New report</span></div>
            <h2 id="report-found-title">Report a found item</h2>
            <p>Provide enough detail for campus staff to verify, secure, and return the item safely.</p>
            <form onSubmit={submitFoundReport}>
              <label className="add-user-field">Item name<input required value={foundReport.title} onChange={(event) => setFoundReport({ ...foundReport, title: event.target.value })} placeholder="e.g. Black wireless headphones" /></label>
              <label className="add-user-field">Found location<select required value={foundReport.location} onChange={(event) => setFoundReport({ ...foundReport, location: event.target.value })}><option value="">Select campus location</option><option>Main Library Commons</option><option>ICT Engineering Hallway</option><option>Student Union Plaza</option><option>Science Quadrangle</option><option>Recreation Center</option><option>Other campus location</option></select></label>
              <label className="add-user-field">Category<select required value={foundReport.category} onChange={(event) => setFoundReport({ ...foundReport, category: event.target.value })}><option value="">Select category</option><option>Electronics</option><option>Keys &amp; access cards</option><option>Books &amp; math</option><option>Clothing &amp; accessories</option><option>Other</option></select></label>
              <label className="add-user-field">Item photo<input type="file" accept="image/*" onChange={handleFoundImageChange} /><span>{foundReport.image ? "Photo attached" : "Choose a photo from this device"}</span></label>
              {foundReport.image && <img className="found-image-preview" src={foundReport.image} alt="Preview of found item" />}
              <label className="add-user-field">Description and distinguishing details<textarea required value={foundReport.description} onChange={(event) => setFoundReport({ ...foundReport, description: event.target.value })} placeholder="Describe color, markings, where it was found, and any safe identifying details." /></label>
              <div className="found-admin-footer"><span>Submitted reports are queued for staff verification.</span><button type="submit" className="danger-button add-user-submit"><FileText size={14} /> {reportFoundSubmitted ? "Submitted" : "Submit found item"}</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="user-action-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUser(null)} aria-label="Close user dialog"><X size={18} /></button>
            <div className="eyebrow"><b>User Registry</b><span>•</span><span>{selectedUser.mode === "edit" ? "Edit account" : "User details"}</span></div>
            <h2 id="user-action-title">{selectedUser.mode === "edit" ? "Edit user" : selectedUser.name}</h2>
            {selectedUser.mode === "details" ? (
              <dl className="user-details-list">
                <div><dt>University email</dt><dd>{selectedUser.id}</dd></div>
                <div><dt>Faculty</dt><dd>{selectedUser.faculty}</dd></div>
                <div><dt>Status</dt><dd>Verified</dd></div>
              </dl>
            ) : (
              <>
                <label className="add-user-field">Full name<input defaultValue={selectedUser.name} /></label>
                <label className="add-user-field">University email<input type="email" defaultValue={selectedUser.id} /></label>
                <label className="add-user-field">Faculty<input defaultValue={selectedUser.faculty} /></label>
                <button className="danger-button add-user-submit" onClick={() => setSelectedUser(null)}><Check size={14} /> Save changes</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [moderatorName, setModeratorName] = useState("J. Vargas");
  const [moderatorInitials, setModeratorInitials] = useState("JV");
  const [activeNav, setActiveNav] = useState("Overview & Triage");
  const [claimFilter, setClaimFilter] = useState("All Risk Tiers");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [claimActionMode, setClaimActionMode] = useState<"view" | "edit">("view");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [search, setSearch] = useState("");
  const [adminNotifications, setAdminNotifications] = useState<Array<{ claim_id: string; student_name: string; item_name: string; created_at: string | null; status: string }>>([]);
  const [itemSummary, setItemSummary] = useState({ found_items: 89, lost_items: 53 });
  const [feedRefresh, setFeedRefresh] = useState(0);

  const handleNavClick = (label: string) => {
    setActiveNav(label);
    if (typeof window === "undefined") return;
    const slug = NAV_SECTION_MAP[label] ?? "overview-and-triage";
    const params = new URLSearchParams(window.location.search);
    params.set("section", slug);
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  };

  const handleResetAdminDetails = () => {
    window.localStorage.removeItem("unialert-admin-profile");
    window.localStorage.removeItem("unialert-session");
    window.location.reload();
  };

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    const name = `${session.firstName} ${session.lastName}`.trim();
    setModeratorName(name || "J. Vargas");
    setModeratorInitials(`${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase() || "JV");
  }, []);

  const navSections: Array<{ label: string; items: Array<[string, typeof Search | typeof PackageCheck | typeof KeyRound | typeof LayoutDashboard | typeof UsersRound | typeof ShieldCheck, string, string]> }> = [
    { label: "", items: [["Overview & Triage", LayoutDashboard, "", "active"], ["User Registry", UsersRound, "", ""], ["Moderator Team", ShieldCheck, "", ""]] },
    { label: "Property Pipeline", items: [["Lost Reports", Search, "", ""], ["Found Items", PackageCheck, "", ""], ["Claim Approvals", KeyRound, "", ""]] },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sectionFromUrl = new URLSearchParams(window.location.search).get("section");
    if (!sectionFromUrl) {
      handleNavClick("Overview & Triage");
      return;
    }

    const match = Object.entries(NAV_SECTION_MAP).find(([, slug]) => slug === sectionFromUrl);
    if (match) {
      setActiveNav(match[0]);
    }
  }, []);

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

  const openClaimAction = (claim: Claim, mode: "view" | "edit") => {
    setSelectedClaim(claim);
    setClaimActionMode(mode);
  };

  return <div className="admin-shell">
    <header className="topbar"><div className="topbar-brand"><span className="mini-mark"><ShieldCheck size={14} /></span><span><b>UniAlert</b><small>Administrator Portal</small></span></div><div className="topbar-context"><ShieldCheck size={14} /> Campus Safety &amp; Property Recovery Service</div><div className="topbar-actions"><label className="global-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case ID, items..." /></label><button className="icon-button" aria-label="Notifications"><BellRing size={16} />{adminNotifications.length > 0 && <i>{adminNotifications.length}</i>}</button><button className="beacon-button" onClick={() => setBroadcastOpen(true)}><Siren size={14} /> Emergency Beacon</button><ProfileDropdown name={moderatorName} initials={moderatorInitials} role="Faculty Moderator" summary="Campus property and claim operations" email="" /></div><AdminThemeToggle /></header>
    <main className="dashboard"><div className="workspace"><aside className="console-rail"><div className="rail-profile"><span className="rail-profile-avatar">{moderatorInitials}</span><span><b>{moderatorName}</b><small>Faculty Moderator</small></span></div><div className="rail-card"><div className="rail-title"><span></span><b></b></div>{navSections.map((section) => <div className="rail-section" key={section.label || "overview-section"}>{section.label && <small>{section.label}</small>}{section.items.map(([label, Icon, count, state]) => <button key={label} className={`rail-link ${activeNav === label ? "current" : ""} ${state}`} onClick={() => handleNavClick(label)}><span><Icon size={14} /> {label}</span>{count && <b>{count}</b>}</button>)}</div>)}</div><div className="rail-footer"><ProfileDropdown name={moderatorName} initials={moderatorInitials} role="Faculty Moderator" summary="Campus property and claim operations" email="" resetLabel="Reset admin details" onReset={handleResetAdminDetails} /></div></aside>
      <section className="content-stage">{activeNav === "Overview & Triage" && <div className="page-heading"><div><div className="eyebrow"><b></b><span></span><span></span></div><h1>Faculty Moderator &amp; Property Command</h1><p></p></div></div>}
        {activeNav === "Overview & Triage" && adminNotifications.length > 0 && <div className="notification-stack">
          {adminNotifications.map((notification) => <div className="notification-item" key={notification.claim_id}><span className="notification-dot" /><div><strong>{notification.claim_id}</strong><small>{notification.student_name} • {notification.item_name}</small><time>{notification.created_at ? new Date(notification.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}</time></div></div>)}
        </div>}
        {activeNav === "Overview & Triage" ? <>
        <div className="kpi-grid">{[["Users Registry", "38,420", "98.2% total users", ShieldCheck, "good"], ["Lost Reports", String(itemSummary.lost_items), "Open and tracked", Search, "blue"], ["Found Items", String(itemSummary.found_items), "Verified & secured", PackageCheck, "neutral"], ["Pending Claims", "7", "Physical ID check required", AlertTriangle, "bad"], ["Campus Advisories", "2", "Live broadcasts active", BellRing, "bad"], ["Reunification Rate", "91.3%", "+4.2% semester goal", Check, "good"]].map(([label, value, note, Icon, tone]) => <article className="kpi-card" key={label as string}><div><span>{label as string}</span><Icon size={15} className={tone as string} /></div><strong className={tone as string}>{value as string}</strong><small className={tone as string}>{note as string}</small></article>)}</div>
        <div className="analytics-grid"><article className="panel trend-panel"><div className="panel-heading"><div><h2>Lost vs. Found Volume &amp; Recovery Trends</h2><p>Real-time intake tracking and automated matching.</p></div><div className="chart-legend"><span className="legend-found">Found <b>(342)</b></span><span className="legend-lost">Lost <b>(284)</b></span><span className="legend-reunified">Reunified <b>(312)</b></span></div></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /></div><div className="bars">{[55, 42, 68, 48, 78, 59, 86].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div><svg viewBox="0 0 500 160" preserveAspectRatio="none" aria-label="Recovery trend line"><path d="M0 125 C70 93, 100 132, 165 104 S260 116, 320 75 S405 86, 500 34" /></svg></div><div className="chart-labels"><span>Week 38</span><span>Week 39</span><span>Week 40</span><span>Week 41</span><span>Week 42</span><b>Week 43 (Live)</b></div></article><article className="panel hotspot-panel"><div className="panel-heading"><div><h2>Intake Hotspots</h2><p>Top high-incident recovery locations across campus hubs.</p></div><MapPin size={15} /></div>{[["W.E.B. Central Library", "34%", "31 items"], ["ICT Research Complex", "22%", "20 items"], ["Student Union Plaza", "18%", "16 items"], ["Sports & Aquatics Arena", "14%", "12 items"], ["North Commons Cafeteria", "12%", "10 items"]].map(([name, percent, total]) => <div className="hotspot" key={name}><div><span>{name}</span><b>{percent}</b></div><div className="progress"><i style={{ width: percent }} /></div><small>{total}</small></div>)}<footer>Locker capacity <b>62% Occupied</b></footer></article><article className="panel pie-chart-panel"><div className="panel-heading"><div><h2>Claim Resolution</h2><p>Time-to-return chain-of-custody efficiency.</p></div><span className="optimal">Optimal</span></div><div className="sla-chart" aria-label="Claim resolution pie chart"><div className="sla-pie"><div className="sla-pie-center"><strong>72%</strong><small>On Time</small></div></div></div><div className="sla-copy"><span><b>On-time claims</b><strong>72%</strong></span><span><b>Escalations</b><strong>18%</strong></span><span><b>Delayed</b><strong>10%</strong></span></div></article></div>
        <section className="panel queue-panel"><div className="queue-header"><div className="queue-title"><span className="queue-icon"><KeyRound size={17} /></span><div><div className="section-kicker">High-value claim review</div><h2>High-Value Claim Verification Queue</h2><p>Claims for high-tier assets require moderator authorization before physical station handover.</p></div><b className="immediate-badge">7 Immediate Action Required</b></div><div className="queue-tools"><label><Filter size={13} /><select value={claimFilter} onChange={(event) => setClaimFilter(event.target.value)}><option>All Risk Tiers</option><option>Immediate</option><option>Review</option></select><ChevronDown size={13} /></label><button onClick={() => { setSearch(""); setFeedRefresh((current) => current + 1); }}><SlidersHorizontal size={13} /> Refresh Feed</button></div></div><div className="claim-table"><div className="table-head"><span>CLAIM ID</span><span>STUDENT / ID</span><span>ITEM SPEC &amp; CUSTODY</span><span /></div>{filteredClaims.map((claim) => <div className="claim-row" key={claim.id}><div><b className={`risk-dot ${claim.tone}`} /> <strong>{claim.id}</strong><small>Logged {claim.age}</small></div><div className="student"><span className={`initials ${claim.tone}`}>{claim.initials}</span><span><b>{claim.student}</b><small>{claim.identity} • {claim.faculty}</small></span></div><div className="item-summary"><span className="item-thumb"><PackageCheck size={14} /></span><span><b>{claim.item}</b><small>{claim.detail}</small></span></div><button className="row-menu" aria-label={`More options for ${claim.id}`}><MoreHorizontal size={17} /></button></div>)}{filteredClaims.length === 0 && <div className="empty-state">No claims match this filter.</div>}<footer className="table-footer"><span>Showing {filteredClaims.length} of 7 high-risk priority claims</span><div><button>Previous</button><b>1</b><button>2</button><button>Next</button></div></footer></div></section>
        <section className="panel composer" id="quick-broadcast-box"><div className="composer-heading"><span className="queue-icon"><Radio size={17} /></span><div><div className="section-kicker">Issue urgent campus alert</div><h2>Broadcast Composer</h2><p>Deploy immediate multi-channel advisories to student mobile push, university emails, and public signage in 3 clicks.</p></div><span className="fast-publish">FAST-PUBLISH SYSTEM</span></div><div className="composer-body"><div className="severity"><span>1. Select Severity Level</span><div><button className="selected"><CircleHelp size={14} /> Advisory</button><button><AlertTriangle size={14} /> Urgent Warning</button><button><X size={14} /> Lockdown / Evac</button></div><label>Quick Template Preload <select><option>Custom Manual Preload</option><option>Severe Weather</option><option>Building Closure</option></select></label></div><div className="message-field"><span>2. Alert Headline &amp; Push Copy</span><input defaultValue="Caution: Science Quadrangle Access Restriction" /><textarea defaultValue="Maintenance crew dispatched for transformer inspection. Please defer pedestrian traffic around North Gate." /><div className="channel-checks"><label><input type="checkbox" defaultChecked /> Push Notification</label><label><input type="checkbox" defaultChecked /> Campus Email Blast</label><label><input type="checkbox" defaultChecked /> Hall LED Displays</label></div></div><div className="authorize"><span>3. Authorization</span><p>Signed as: Officer J. Vargas (Lead Dispatcher)</p><small>Audit Hash: #AUTH-991204</small><button onClick={() => setBroadcastSent(true)}><Check size={15} /> Authorize &amp; Transmit</button>{broadcastSent && <b className="sent-message">Broadcast queued for dispatch.</b>}</div></div></section>
      </> : <AdminFeatureView name={activeNav} />}
      </section></div></main>
    {broadcastOpen && <div className="modal-backdrop"><div className="broadcast-modal" role="dialog" aria-modal="true" aria-labelledby="broadcast-title"><button className="modal-close" onClick={() => setBroadcastOpen(false)} aria-label="Close"><X size={18} /></button><Siren size={22} className="modal-icon" /><h2 id="broadcast-title">Emergency broadcast control</h2><p>The active feed is currently reaching 12,410 recipients across push, email, and hall displays.</p><button className="danger-button" onClick={() => { setBroadcastSent(true); setBroadcastOpen(false); }}><Radio size={15} /> Confirm dispatch</button></div></div>}
    {selectedClaim && <div className="modal-backdrop" onClick={() => setSelectedClaim(null)}><div className="broadcast-modal add-user-modal" role="dialog" aria-modal="true" aria-labelledby="claim-detail-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedClaim(null)} aria-label="Close claim details"><X size={18} /></button><div className="eyebrow"><b>Claim Verification</b><span>•</span><span>{claimActionMode === "edit" ? "Edit review" : "Record details"}</span></div><h2 id="claim-detail-title">{selectedClaim.id}</h2><p>{selectedClaim.item}</p>{claimActionMode === "edit" ? <><label className="add-user-field">Student name<input defaultValue={selectedClaim.student} /></label><label className="add-user-field">University ID<input defaultValue={selectedClaim.identity} /></label><label className="add-user-field">Faculty<input defaultValue={selectedClaim.faculty} /></label><label className="add-user-field">Item detail<textarea defaultValue={selectedClaim.detail} /></label><button className="danger-button add-user-submit" onClick={() => setSelectedClaim(null)}><Check size={14} /> Save changes</button></> : <dl className="user-details-list"><div><dt>Student</dt><dd>{selectedClaim.student}</dd></div><div><dt>University ID</dt><dd>{selectedClaim.identity}</dd></div><div><dt>Faculty</dt><dd>{selectedClaim.faculty}</dd></div><div><dt>Item</dt><dd>{selectedClaim.item}</dd></div><div><dt>Evidence</dt><dd>{selectedClaim.detail}</dd></div><div><dt>Review status</dt><dd>{selectedClaim.tone === "red" ? "Immediate review" : "Moderate review"}</dd></div></dl>}</div></div>}
  </div>;
}