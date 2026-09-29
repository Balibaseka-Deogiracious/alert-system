"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileDropdown, ThemeToggle } from "../theme-provider";
import { dashboardPath, getSession, Session, submitClaim } from "../auth";

const FOUND_ITEMS_STORAGE_KEY = "unialert-found-items";

type FoundItem = {
  id: string;
  title: string;
  location: string;
  category: string;
  description: string;
  image?: string;
  submittedBy: string;
  submittedAt: string;
};

const matches = [
  {
    name: "Midnight Blue Leather Backpack",
    location: "ICT Lab 302",
    caseId: "LR-2025-0941",
    status: "Possible Match",
    tone: "warning",
    small: "94% feature match",
    icon: "◈"
  },
  {
    name: "Apple AirPods Pro 2nd Gen",
    location: "Red Science Lab",
    caseId: "LR-2025-0812",
    status: "Searching",
    tone: "muted",
    small: "Waiting on review",
    icon: "◉"
  },
  {
    name: "Ti-Nspire CX II Calculator",
    location: "Math Annex",
    caseId: "LR-2025-0684",
    status: "Collected",
    tone: "success",
    small: "Recovered at desk",
    icon: "◌"
  },
  {
    name: "Olive Green 32oz Insulated Flask",
    location: "Student Union",
    caseId: "LR-2025-0118",
    status: "Pending Review",
    tone: "info",
    small: "Awaiting confirmation",
    icon: "◐"
  }
];

const campusFound = [
  { title: "Keychron K2 Mech...", place: "Science Station Desk", status: "Found", time: "2h ago", tone: "keyboard", action: "Claim Item" },
  { title: "Sony WH-1000XM...", place: "Central Dispatch", status: "Found", time: "4h ago", tone: "headphones", action: "Claim Item" },
  { title: "University ID + Met...", place: "Student Union Info Desk", status: "Found", time: "6h ago", tone: "id", action: "Claim Item" },
  { title: "Ray-Ban Prescription...", place: "Main Library Desk", status: "Found", time: "7h ago", tone: "glasses", action: "Claim Item" }
];

const bulletinItems = [
  { type: "Security Priority", title: "Theft Prevention Alert: West Gym", time: "22m ago", color: "red", text: "Multiple locker breaches reported between 14:00-16:00. Ensure heavy-duty combo locks are engaged." },
  { type: "Facility Advisory", title: "Science Tower Power Grid Maintenance", time: "2h ago", color: "blue", text: "Floors 4-7 power shutdown scheduled today 18:00-22:00. Computer labs offline." },
  { type: "Operational Notice", title: "Library North Wing Extended Hours", time: "5h ago", color: "teal", text: "Midterm review week: central recovery drop-box extended through Friday evening." }
];

const recoveryStations = [
  { title: "Central Police Dispatch", time: "Open now", status: "Campus Safety" },
  { title: "Main Library Circulation", time: "Closed 23:00", status: "Campus Study" },
  { title: "Student Union Information", time: "Closed 19:00", status: "Campus Info" },
];

export default function StudentDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [activeSection, setActiveSection] = useState("Student Dashboard");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [report, setReport] = useState({ title: "", location: "", category: "", description: "", image: "" });
  const [claimSubmitted, setClaimSubmitted] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) router.replace("/signin");
    else if (session.role !== "student") router.replace(dashboardPath(session.role));
    else setSession(session);
  }, [router]);

  const displayName = session ? `${session.firstName} ${session.lastName}` : "Student";
  const initials = session ? `${session.firstName[0] || ""}${session.lastName[0] || ""}`.toUpperCase() : "ST";
  const studentId = session?.studentId || "Student account";
  const faculty = session?.faculty || "Faculty not provided";

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setReport((current) => ({ ...current, image: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newItem: FoundItem = {
      id: `FOUND-${Date.now().toString().slice(-6)}`,
      ...report,
      submittedBy: displayName,
      submittedAt: new Date().toISOString(),
    };
    const savedItems = JSON.parse(localStorage.getItem(FOUND_ITEMS_STORAGE_KEY) || "[]") as FoundItem[];
    localStorage.setItem(FOUND_ITEMS_STORAGE_KEY, JSON.stringify([newItem, ...savedItems]));
    setReport({ title: "", location: "", category: "", description: "", image: "" });
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setReportOpen(false);
    }, 1800);
  }

  async function handleClaim(itemName: string, location: string) {
    if (!session) return;
    try {
      await submitClaim({ studentId: session.studentId || session.email, studentName: displayName, itemName, location });
      setClaimSubmitted(itemName);
      window.setTimeout(() => setClaimSubmitted(""), 2500);
    } catch (error) {
      console.error("Failed to submit claim", error);
    }
  }

  return (
    <div className="student-dashboard">
      <aside className="student-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-mark">U</div>
            <div className="brand-copy">
              <span className="brand-name">UniAlert</span>
              <small>Fall 2025 Portal</small>
            </div>
          </div>
        </div>

            <div className="user-pill">
          <div className="avatar">{initials}</div>
          <div className="user-meta">
            <span>{displayName}</span>
            <small>{studentId}</small>
          </div>
        </div>

        <nav className="side-nav">
          {[
            ["Student Dashboard", "dashboard"],
            ["Find an Item", "find"],
            ["Campus Alerts", "alerts"],
          ].map(([label]) => <button key={label} className={`nav-item ${activeSection === label ? "active" : ""}`} onClick={() => setActiveSection(label)}>{label}</button>)}
        </nav>

        <div className="dispatch-box">
          <span className="dispatch-label">Police Dispatch</span>
          <strong>555-0199 | Ext. 44</strong>
        </div>
      </aside>

      <main className="student-content">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="mini-mark">U</div>
            <span>UniAlert</span>
          </div>
          <div className="topbar-ledger">Campus Safety &amp; Property Recovery Service</div>

          <div className="topbar-actions">
            <label className="search-mini">
              <span>⌕</span>
              <input placeholder="Search case ID, items..." />
            </label>
            <ThemeToggle />
            <ProfileDropdown name={displayName} initials={initials} role="Student" summary="Student property and safety dashboard" email={session?.email || ""} />
          </div>
        </header>

        <div className="content-area">
          {activeSection !== "Student Dashboard" && <section className="student-subview">
            <div className="subview-heading"><div><span className="eyebrow">{activeSection === "Find an Item" ? "Property recovery" : "Campus communications"}</span><h1>{activeSection}</h1><p>{activeSection === "Find an Item" ? "Search recently recovered property and review possible matches across campus stations." : "Stay informed about safety, facility, and operational notices across campus."}</p></div>{activeSection === "Find an Item" && <button className="soft-accent active" onClick={() => setReportOpen(true)}>Report Found Item</button>}</div>
            {activeSection === "Find an Item" ? <div className="student-subview-grid"><section className="panel search-results-panel"><div className="panel-header"><div><span className="eyebrow">Recovered property</span><h2>Available items</h2></div><div className="header-sort"><span>Latest first</span></div></div>{campusFound.map((item) => <article className="search-result" key={item.title}><div className={`thumb ${item.tone}`}><span>{item.title.charAt(0)}</span></div><div><span className="found-status">{item.status}</span><h3>{item.title}</h3><small>{item.place} • {item.time}</small></div><button className="claim-button">{item.action}</button></article>)}</section><section className="panel search-results-panel"><div className="panel-header"><div><span className="eyebrow">Possible matches</span><h2>Reports to review</h2></div></div>{matches.map((item) => <article className="match-result" key={item.caseId}><div><strong>{item.name}</strong><small>{item.location} • {item.caseId}</small></div><span className={`tag ${item.tone}`}>{item.status}</span></article>)}</section></div> : <section className="panel alerts-directory"><div className="panel-header"><div><span className="eyebrow">Live bulletins</span><h2>Campus alerts</h2></div><span className="status-pill success">{bulletinItems.length} active</span></div>{bulletinItems.map((item) => <article key={item.title} className={`bulletin-card ${item.color}`}><div className="bulletin-head"><span>{item.type}</span><time>{item.time}</time></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</section>}
          </section>}
          <div className={activeSection === "Student Dashboard" ? "dashboard-home" : "dashboard-home hidden-home"}>
          <section className="match-alert">
            <div className="alert-icon">⚠</div>
            <div className="alert-copy">
              <span className="alert-badge">Potential match detected</span>
              <p>
                An item logged as <strong>Midnight Blue Leather Backpack</strong> at ICT Lab 302 shares a 94% feature match with your report from yesterday.
              </p>
            </div>
            <div className="alert-actions">
              <button className="primary">Review Match</button>
              <button className="secondary">Dismiss</button>
            </div>
          </section>

          <section className="welcome-card">
            <div className="verification-row">
              <span className="status-pill success">Verified Student Account</span>
              <span className="status-pill muted">SSO authenticated via Duo</span>
            </div>

            <div className="welcome-row">
              <div className="welcome-copy">
                <h1>Welcome back, {displayName}</h1>
                <p>
                  <span className="tiny-id">ID:</span> {studentId} • {faculty} • {session?.email || "University email pending"}
                </p>
              </div>

              <div className="welcome-actions">
                <button className="soft-accent">Report Lost Item</button>
                <button className="soft-accent active" onClick={() => setReportOpen(true)}>Report Found Item</button>
                <button className="ghost-accent">Search Database</button>
              </div>
            </div>
          </section>

          <section className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Lost items reported</div>
              <div className="summary-inner">
                <span className="summary-number">2</span>
                <span className="summary-meta">Active cases</span>
              </div>
              <div className="summary-notes">
                <span>Searching</span>
                <span>1 Potential Match</span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Safe transfer</div>
              <div className="summary-inner">
                <span className="summary-number">1</span>
                <span className="summary-meta">Item transfer</span>
              </div>
              <div className="summary-notes">
                <span>Approved</span>
                <span>Library Desk</span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Live bulletins</div>
              <div className="summary-inner">
                <span className="summary-number">3</span>
                <span className="summary-meta">Active alerts</span>
              </div>
              <div className="summary-notes">
                <span>1 Security</span>
                <span>1 Facility</span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-label">Pending claims</div>
              <div className="summary-inner">
                <span className="summary-number">2</span>
                <span className="summary-meta">Verification queue</span>
              </div>
              <div className="summary-notes">
                <span>1 Moderator</span>
                <span>1 Ready</span>
              </div>
            </div>
          </section>

          <section className="split-grid">
            <div className="panel reports-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">My Active Reports &amp; Claims</span>
                  <h2>Live property status</h2>
                </div>
                <div className="header-sort">
                  <span>Sort: Latest Update</span>
                </div>
              </div>

              <div className="table-head">
                <span>Item details</span>
                <span>Case ID</span>
                <span>Updated</span>
                <span>Status</span>
              </div>

              {matches.map((item) => (
                <div className="row-item" key={item.caseId}>
                  <div className="item-details">
                    <span className="row-icon">{item.icon}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.location}</small>
                    </div>
                  </div>
                  <div className="case-id">{item.caseId}</div>
                  <div className="case-date">Oct 24, 2025</div>
                  <div className={`tag ${item.tone}`}>{item.status}</div>
                </div>
              ))}
            </div>

            <div className="panel alerts-panel">
              <div className="panel-header compact">
                <div>
                  <span className="eyebrow">Campus bulletins</span>
                  <h2>3 active</h2>
                </div>
              </div>

              <div className="bulletin-list">
                {bulletinItems.map((item) => (
                  <article key={item.title} className={`bulletin-card ${item.color}`}>
                    <div className="bulletin-head">
                      <span>{item.type}</span>
                      <time>{item.time}</time>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="panel recent-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Recent Campus Found Items</span>
                  <h2>Items turned in this week</h2>
                </div>
                <div className="header-sort">
                  <span>All Recent</span>
                </div>
              </div>

              <div className="found-grid">
                {campusFound.map((item) => (
                  <article key={item.title} className="found-card">
                    <div className={`thumb ${item.tone}`}>
                      <span>{item.title.charAt(0)}</span>
                    </div>
                    <div className="found-copy">
                      <span className="found-status">{item.status}</span>
                      <h3>{item.title}</h3>
                      <small>{item.place}</small>
                    </div>
                    <button className="claim-button" onClick={() => handleClaim(item.title, item.place)}>{claimSubmitted === item.title ? "Submitted" : item.action}</button>
                  </article>
                ))}
              </div>

              <div className="more-link">Explore All 142 Active Recovered Items →</div>
            </div>

            <div className="panel side-panel">
              <div className="panel-header compact">
                <div>
                  <span className="eyebrow">Recovery stations</span>
                  <h2>Campus map</h2>
                </div>
                <div className="header-sort">
                  <span>Campus</span>
                </div>
              </div>

              <div className="station-list">
                {recoveryStations.map((station) => (
                  <div key={station.title} className="station-item">
                    <div className="station-dot" />
                    <div className="station-copy">
                      <strong>{station.title}</strong>
                      <small>{station.status}</small>
                    </div>
                    <span>{station.time}</span>
                  </div>
                ))}
              </div>

              <button className="map-button">View Campus Custody Map</button>

              <div className="protocol-box">
                <div className="protocol-head">Property Security Protocol</div>
                <h3>Protecting your digital devices</h3>
                <p>
                  Record your laptop and tablet MAC address and serial numbers within your student profile. In the event of misplacement, automated inventory tracking can quickly validate ownership.
                </p>
                <div className="mini-details">
                  <span>Register Device</span>
                  <span>ISO-27001</span>
                </div>
              </div>
            </div>
          </section>
          </div>
        </div>
      </main>

      {reportOpen && (
        <div className="student-modal-backdrop">
          <section className="found-report-modal" role="dialog" aria-modal="true" aria-labelledby="found-report-title">
            <button className="found-report-close" onClick={() => setReportOpen(false)} aria-label="Close found item form">×</button>
            <div className="found-report-kicker">Student property intake</div>
            <h2 id="found-report-title">Report a found item</h2>
            <p>Provide enough detail for campus staff to verify, secure, and return the item safely.</p>
            <form onSubmit={handleReportSubmit}>
              <div className="found-form-grid">
                <label>
                  Item name
                  <input required value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} placeholder="e.g. Black wireless headphones" />
                </label>
                <label>
                  Found location
                  <select required value={report.location} onChange={(event) => setReport({ ...report, location: event.target.value })}>
                    <option value="">Select campus location</option>
                    <option>Main Library Commons</option>
                    <option>ICT Engineering Hallway</option>
                    <option>Student Union Plaza</option>
                    <option>Science Quadrangle</option>
                    <option>Recreation Center</option>
                    <option>Other campus location</option>
                  </select>
                </label>
                <label>
                  Category
                  <select required value={report.category} onChange={(event) => setReport({ ...report, category: event.target.value })}>
                    <option value="">Select category</option>
                    <option>Electronics</option>
                    <option>Keys &amp; access cards</option>
                    <option>Books &amp; math</option>
                    <option>Clothing &amp; accessories</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="found-upload-label">
                  Item photo
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  <span>{report.image ? "Photo attached" : "Choose a photo from this device"}</span>
                </label>
              </div>
              {report.image && <img className="found-image-preview" src={report.image} alt="Preview of found item" />}
              <label className="found-description-label">
                Description and distinguishing details
                <textarea required value={report.description} onChange={(event) => setReport({ ...report, description: event.target.value })} placeholder="Describe color, markings, where it was found, and any safe identifying details." />
              </label>
              <div className="found-form-footer">
                <span>Submitted reports are uploaded directly to the property records.</span>
                <div>
                  <button type="button" className="found-cancel" onClick={() => setReportOpen(false)}>Cancel</button>
                  <button type="submit" className="found-submit">{reportSubmitted ? "Submitted" : "Submit found item"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
