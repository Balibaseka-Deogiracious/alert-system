"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-provider";
import { dashboardPath, getSession } from "./auth";

const FOUND_ITEMS_STORAGE_KEY = "unialert-found-items";

type SubmittedFoundItem = {
  id: string;
  title: string;
  location: string;
  category: string;
  description: string;
  image?: string;
  submittedBy: string;
  submittedAt: string;
};

type RecoveryItemDetails = {
  title: string;
  location: string;
  time: string;
  description: string;
  category?: string;
  reference: string;
  image?: string;
};

const metrics = [
  { label: "Total Intake", value: "4,820+", note: "+142 logged past 7 days", icon: "inventory" },
  { label: "Verified Match", value: "89.4%", note: "High Clery verification score", icon: "verified" },
  { label: "Data Privacy", value: "100%", note: "Zero public serial disclosures", icon: "lock" },
];

const items = [
  { ref: "MC-8810", title: "MacBook Pro 14\" (Space Gray)", place: "Main Library Commons", time: "Today, 11:20 AM", detail: "Found at 2nd Floor Study Commons near North Carrels. Contains faculty sticker on lower right chassis. Serial masked for safety.", image: "/images/design/laptop.jpg" },
  { ref: "HF-3329", title: "Hydro Flask (32oz)", place: "Recreation Center Gym", time: "Today, 09:45 AM", detail: "Blue insulated bottle left on bench near pool entrance. Name tag removed and stored in secure intake lockbox.", image: "/images/design/flask.jpg" },
  { ref: "KC-9021", title: "Keyring + Student Access Card", place: "ICT Engineering Hallway", time: "Yesterday, 4:10 PM", detail: "Black leather ring and access tag discovered near east stairwell. Owner verification pending.", image: "/images/design/keys.jpg" },
  { ref: "PL-4102", title: "Graphing Calculator (TI-84)", place: "Math Annex", time: "Yesterday, 1:35 PM", detail: "Found in study carrel between exam rooms. Protective pouch still intact and barrier-tagged.", image: "/images/design/calculator.jpg" },
  { ref: "BK-2227", title: "Leather Wallet (Brown)", place: "Student Union Plaza", time: "Today, 08:15 AM", detail: "Recovered beside seating area near central concourse. ID and transit cards removed for safe review.", image: "/images/design/wallet.jpg" },
  { ref: "PH-7714", title: "Over-Ear ANC Headphones", place: "Campus Ops Loading Dock", time: "Today, 06:30 AM", detail: "Black over-ear set found in service cart bin. Charging cable and case intact. Serial masked.", image: "/images/design/headphones.jpg" },
];

const alerts = [
  { tone: "urgent", label: "Urgent • Facility", time: "42m ago", title: "West Science Quad Chiller Maintenance", text: "Pedestrian breezeway between Biology Hall and Chemistry Annex is closed. Please utilize South Perimeter walk.", source: "Facilities Ops" },
  { tone: "advisory", label: "Security • Advisory", time: "2h ago", title: "Bicycle Lock Integrity Warning: Lot E", text: "Campus Police report attempted tamperings on cable locks. U-locks are mandated and offered free at Central Police Station.", source: "Campus Police" },
  { tone: "transit", label: "Transit • Advisory", time: "6h ago", title: "Campus Blue Line Shuttle Route Diverted", text: "Due to repaving on North University Drive, Shuttle Stop 7 will shift to Student Union Circle through Thursday evening.", source: "Transit Dept" },
];

const protocol = [
  { number: "01", title: "SSO Authentication", description: "Log in with your official university credentials. Only active students, faculty, and vetted staff can lodge or browse detailed records.", note: "FERPA compliant" },
  { number: "02", title: "Intake & Geo-Tagging", description: "Submit photo evidence, timestamp, and campus quadrant. Our automated tool scrubs serials before public listing.", note: "Pinpoint geozones" },
  { number: "03", title: "Smart Match Review", description: "System cross-references lost reports with found intakes. Dispatchers verify secret distinguishing markers.", note: "98.2% match accuracy" },
  { number: "04", title: "Secure Hub Claim", description: "Present your generated pickup QR code and official photo ID at your chosen physical hub desk to collect your recovered item.", note: "Immediate safe handoff" },
];

const depots = [
  { tone: "urgent", title: "Central Police Dispatch", location: "Ground Floor Administration Building • Room 102 (East Entrance)", hours: "24/7 / 365", detail: "Phones, Laptops & Keys\nEmergency Inquiries", value: "555-0199" },
  { tone: "blue", title: "Library Main Service Desk", location: "Williamson Memorial Library • 1st Floor Central Atrium", hours: "8:00 AM – 10:00 PM", detail: "Textbooks & Calculators\nDirect Desk Extension", value: "Ext. 2140" },
  { tone: "teal", title: "Student Union Info Booth", location: "Student Activity Complex • Concourse Level", hours: "9:00 AM – 6:00 PM", detail: "Clothing, IDs & Bottles\nDirect Desk Extension", value: "Ext. 1105" },
];

export default function HomePage() {
  const router = useRouter();
  const [submittedItems, setSubmittedItems] = useState<SubmittedFoundItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<RecoveryItemDetails | null>(null);
  const [reportType, setReportType] = useState<"lost" | "found" | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportForm, setReportForm] = useState({ title: "", location: "", category: "", description: "" });
  const [reportImage, setReportImage] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredSubmittedItems = submittedItems.filter((item) => !normalizedSearchQuery || `${item.title} ${item.location} ${item.category} ${item.description}`.toLowerCase().includes(normalizedSearchQuery));
  const filteredCatalogItems = items.filter((item) => !normalizedSearchQuery || `${item.title} ${item.place} ${item.detail}`.toLowerCase().includes(normalizedSearchQuery));
  const searchResultCount = filteredSubmittedItems.length + filteredCatalogItems.length;

  useEffect(() => {
    const session = getSession();
    if (session) router.replace(dashboardPath(session.role));
  }, [router]);

  function submitPublicReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reportType === "found") {
      const submittedItem: SubmittedFoundItem = { id: `FOUND-${Date.now().toString().slice(-6)}`, ...reportForm, image: reportImage || undefined, submittedBy: "Public portal visitor", submittedAt: new Date().toISOString() };
      const nextItems = [submittedItem, ...submittedItems];
      setSubmittedItems(nextItems);
      window.localStorage.setItem(FOUND_ITEMS_STORAGE_KEY, JSON.stringify(nextItems));
    }
    setReportSubmitted(true);
    window.setTimeout(() => { setReportSubmitted(false); setReportType(null); setReportForm({ title: "", location: "", category: "", description: "" }); setReportImage(""); }, 1200);
  }

  function handlePublicImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReportImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const storedItems = window.localStorage.getItem(FOUND_ITEMS_STORAGE_KEY);
    if (storedItems) setSubmittedItems(JSON.parse(storedItems) as SubmittedFoundItem[]);
  }, []);

  useEffect(() => {
    const updateScrollButton = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    updateScrollButton();
    return () => window.removeEventListener("scroll", updateScrollButton);
  }, []);

  return (
    <div className="portal-shell" id="top">
      <header className="site-header">
        <div className="brand-wrap">
          <div className="brand-mark">U</div>
          <div className="brand-text">
            <span>UniAlert</span>
            <small>Campus Safety &amp; Property Recovery Service</small>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <Link href="#">Home</Link>
          <Link href="#recovery-registry">Find an Item</Link>
          <Link href="#alerts">Campus Alerts</Link>
        </nav>

        <div className="header-tools auth-actions">
          <ThemeToggle />
          <Link href="/signin" className="auth-link sign-in-link">
            Sign in
          </Link>
          <Link href="/signup" className="auth-link sign-up-link">
            Sign up
          </Link>
        </div>
      </header>

      <main className="page-body">
        <section className="hero-section">
          <div className="hero-header-tag">
            <span>✓</span>
            Division of Public Safety &amp; Asset Integrity
          </div>

          <h1>
            Find It. Report It. <span>Recover It.</span>
          </h1>

          <p className="hero-subtitle">
            The official university campus security and property restoration portal. Fast,
            verified recovery with protected student privacy for over 38,000 students and
            university staff.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={() => setReportType("found")}>Report Found Item</button>
            <button type="button" className="secondary" onClick={() => setReportType("lost")}>Report Lost Item</button>
            <a href="#recovery-registry" className="ghost">Find an Item</a>
          </div>

          <div className="quick-search">
            <div className="search-field search-text">
              <span>⌕</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search keywords (e.g., 'Hydro Flask', 'MacBook', 'Leather Keyring')..." aria-label="Search recovered items" />
            </div>

            <div className="search-field select-field">
              <span>▣</span>
              <select defaultValue="">
                <option value="" disabled>
                  All Categories
                </option>
                <option>Laptops &amp; Phones</option>
                <option>Keys &amp; Cards</option>
                <option>Accessories</option>
                <option>Books &amp; Math</option>
              </select>
            </div>

            <div className="search-field select-field">
              <span>◉</span>
              <select defaultValue="">
                <option value="" disabled>
                  All Locations
                </option>
                <option>Main Library Commons</option>
                <option>West Science Quad</option>
                <option>ICT Engineering Hallway</option>
                <option>Student Union Plaza</option>
              </select>
            </div>

            <button type="button" className="search-submit" onClick={() => document.getElementById("recovery-registry")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Search Campus Registry
            </button>
          </div>
        </section>

        <section className="stats-grid" aria-label="Platform metrics">
          {metrics.map((metric) => (
            <article key={metric.label} className="stat-card">
              <div className="stat-top">
                <span>{metric.label}</span>
                <div className="stat-icon">{metric.icon}</div>
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </article>
          ))}
        </section>

        <section className="feed-section" id="recovery-registry">
          <div className="section-head">
            <div>
              <span className="kicker">Live Intakes</span>
              <h2>Campus Property Recovery Feed</h2>
              <p>Review recently turned-in items. Identifiers and serials are masked for student security.</p>
            </div>

            <div className="chip-row" aria-label="Filters">
              {['All', 'Laptops & Phones', 'Keys & Cards', 'Accessories', 'Books & Math'].map((filter) => (
                <button key={filter} type="button" className={filter === 'All' ? 'chip active' : 'chip'}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="item-grid">
            {filteredSubmittedItems.map((item) => (
              <article key={item.id} className="item-card submitted-item-card">
                <div className="image-wrap">
                  {item.image ? (
                    <img src={item.image} alt={item.title} />
                  ) : (
                    <div className="submitted-image-fallback">Found</div>
                  )}
                  <span className="badge">New submission</span>
                  <b>Report: #{item.id}</b>
                </div>
                <div className="item-body">
                  <div className="meta-row"><span>{item.category}</span><span>{new Date(item.submittedAt).toLocaleDateString()}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedItem({
                        title: item.title,
                        location: item.location,
                        time: new Date(item.submittedAt).toLocaleString(),
                        description: item.description,
                        category: item.category,
                        reference: `Report #${item.id}`,
                        image: item.image,
                      })}
                    >
                      View Item
                    </button>
                    <span className="submitted-review">Pending review</span>
                  </div>
                </div>
              </article>
            ))}
            {filteredCatalogItems.map((item) => (
              <article key={item.ref} className="item-card">
                <div className="image-wrap">
                  <Image src={item.image} alt={item.title} width={640} height={420} />
                  <span className="badge">Found</span>
                  <b>Vault Ref: #{item.ref}</b>
                </div>

                <div className="item-body">
                  <div className="meta-row">
                    <span>{item.place}</span>
                    <time>{item.time}</time>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedItem({
                        title: item.title,
                        location: item.place,
                        time: item.time,
                        description: item.detail,
                        reference: `Vault Ref #${item.ref}`,
                        image: item.image,
                      })}
                    >
                      View Item
                    </button>
                    <Link href="/signin" className="claim-button">Submit Claim</Link>
                  </div>
                </div>
              </article>
            ))}
            {searchResultCount === 0 && <div className="empty-feed-state">No recovered items match &ldquo;{searchQuery}&rdquo;. Try a different item name, location, or keyword.</div>}
          </div>

          <div className="explore-row">
            <button type="button">Explore All 420+ Open Campus Catalog Items</button>
          </div>
        </section>

        {selectedItem && (
          <div className="item-details-backdrop" onClick={() => setSelectedItem(null)}>
            <section
              className="item-details-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="item-details-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="item-details-close"
                onClick={() => setSelectedItem(null)}
                aria-label="Close item details"
              >
                ×
              </button>

              {selectedItem.image ? (
                <img className="item-details-image" src={selectedItem.image} alt={selectedItem.title} />
              ) : (
                <div className="item-details-image item-details-image-fallback">Found item</div>
              )}
              <div className="item-details-content">
                <span className="kicker">Item details</span>
                <h2 id="item-details-title">{selectedItem.title}</h2>
                <div className="item-details-meta">
                  <span><strong>Found at</strong>{selectedItem.location}</span>
                  <span><strong>Posted</strong>{selectedItem.time}</span>
                  {selectedItem.category && <span><strong>Category</strong>{selectedItem.category}</span>}
                  <span><strong>Reference</strong>{selectedItem.reference}</span>
                </div>
                <p>{selectedItem.description}</p>
              </div>
            </section>
          </div>
        )}

        {reportType && (
          <div className="item-details-backdrop" onClick={() => setReportType(null)}>
            <section className="item-details-modal public-report-modal" role="dialog" aria-modal="true" aria-labelledby="public-report-title" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="item-details-close" onClick={() => setReportType(null)} aria-label="Close report form">×</button>
              <div className="item-details-content">
                <span className="kicker">{reportType === "lost" ? "Lost reports • New report" : "Found items • New report"}</span>
                <h2 id="public-report-title">Report {reportType === "lost" ? "lost" : "a found"} item</h2>
                <p>{reportType === "lost" ? "Tell the recovery team where and when you last saw your property." : "Provide enough detail for campus staff to verify, secure, and return the item safely. Provide enough detail for staff to record and secure the item."}</p>
                {reportSubmitted ? <div className="auth-success">Your report was submitted for review.</div> : <form className="auth-form" onSubmit={submitPublicReport}>
                  <label>Item name<input required value={reportForm.title} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} placeholder={reportType === "lost" ? "e.g. Midnight blue backpack" : "e.g. Black wireless headphones"} /></label>
                  {reportType === "found" ? <>
                    <label>Found location<select required value={reportForm.location} onChange={(event) => setReportForm({ ...reportForm, location: event.target.value })}><option value="">Select campus location</option><option>Main Library Commons</option><option>ICT Engineering Hallway</option><option>Student Union Plaza</option><option>Science Quadrangle</option><option>Recreation Center</option></select></label>
                    <label>Category<select required value={reportForm.category} onChange={(event) => setReportForm({ ...reportForm, category: event.target.value })}><option value="">Select category</option><option>Electronics</option><option>Keys &amp; access cards</option><option>Books &amp; math</option><option>Clothing &amp; accessories</option><option>Other</option></select></label>
                    <label>Item photo<input type="file" accept="image/*" onChange={handlePublicImageChange} /><small>Choose a photo from this device</small></label>
                    <label>Description and distinguishing details<textarea required value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} placeholder="Describe color, markings, where it was found, and any safe identifying details." /></label>
                    <small className="public-report-note">Uploaded directly to the property records.</small>
                  </> : <>
                    <label>Last known location<input required value={reportForm.location} onChange={(event) => setReportForm({ ...reportForm, location: event.target.value })} placeholder="e.g. West Gym" /></label>
                    <label>Description<textarea required value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} placeholder="Add identifying details" /></label>
                  </>}
                  <button type="submit" className="auth-submit">{reportType === "found" ? "Submit found item" : "Submit report"}</button>
                </form>}
              </div>
            </section>
          </div>
        )}

        <section className="alerts-section" id="alerts">
          <div className="section-head tight-head">
            <div>
              <span className="kicker emergency">Emergency Operations</span>
              <h2>Live Campus Safety Bulletins</h2>
            </div>
            <Link href="#alerts" className="view-link">View All Archived Alerts</Link>
          </div>

          <div className="alert-grid">
            {alerts.map((alert) => (
              <article key={alert.title} className={`alert-card ${alert.tone}`}>
                <div className="alert-meta">
                  <span>{alert.label}</span>
                  <time>{alert.time}</time>
                </div>
                <h3>{alert.title}</h3>
                <p>{alert.text}</p>
                <div className="alert-footer">
                  <small>{alert.source}</small>
                  <Link href="#alerts">Read Advisory</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="process-section">
          <div className="section-head center-head">
            <span className="kicker">Streamlined Protocol</span>
            <h2>How Campus Recovery Works</h2>
            <p>From loss to retrieval, our audited workflow ensures student assets are returned quickly without compromising privacy.</p>
          </div>

          <div className="protocol-grid">
            {protocol.map((step) => (
              <article key={step.number} className="protocol-card">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <small>{step.note}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="hubs-section">
          <div className="section-head tight-head">
            <div>
              <span className="kicker">Physical Collection Depots</span>
              <h2>Campus Hub Locations &amp; Desk Hours</h2>
              <p>Items turned in across campus are transferred to designated secure custody points daily.</p>
            </div>
            <span className="open-tag">Central Police Dispatch Open Now</span>
          </div>

          <div className="hub-grid">
            {depots.map((hub) => (
              <article key={hub.title} className={`hub-card ${hub.tone}`}>
                <div className="hub-top">
                  <span>{hub.title}</span>
                  <b>{hub.hours}</b>
                </div>
                <h3>{hub.title}</h3>
                <p>{hub.location}</p>
                <div className="hub-detail">
                  <div>
                    <strong>{hub.detail.split('\n')[0]}</strong>
                    <small>{hub.value}</small>
                  </div>
                  <div>
                    <strong>{hub.detail.split('\n')[1]}</strong>
                    <small>Campus Desk</small>
                  </div>
                </div>
                <button type="button">Get Walking Directions</button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <div className="brand-wrap narrow">
            <div className="brand-mark">U</div>
            <div className="brand-text">
              <span>UniAlert</span>
              <small>Campus Safety &amp; Property Recovery</small>
            </div>
          </div>
          <p>Trusted campus safety communications and verified property recovery for students, faculty, and staff.</p>
        </div>

        <div className="footer-column">
          <h4>Explore</h4>
          <a href="#recovery-registry">Campus recovery feed</a>
          <a href="#alerts">Safety bulletins</a>
          <a href="#recovery-registry">Report found property</a>
          <a href="#top">Back to top</a>
        </div>

        <div className="footer-column">
          <h4>Support</h4>
          <a href="tel:5550199">Emergency desk: 555-0199</a>
          <a href="tel:5550143">Non-emergency: 555-0143</a>
          <a href="mailto:safety@kyu.ac.ug">safety@kyu.ac.ug</a>
          <span>Campus support available 24/7</span>
        </div>

        <div className="footer-column">
          <h4>Information</h4>
          <a href="#privacy">Privacy and data use</a>
          <a href="#accessibility">Accessibility</a>
          <a href="#terms">Terms of use</a>
          <span>Identifiers are masked for student privacy.</span>
        </div>

        <div className="footer-bottom">
          <span>© 2026 UniAlert. Campus Safety &amp; Property Recovery.</span>
          <span>Official university service · All campuses</span>
        </div>
      </footer>

      {showScrollTop && (
        <button
          type="button"
          className="back-to-top-button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
