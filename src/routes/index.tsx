import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Layers,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  MapPin,
  LockKeyhole,
} from "lucide-react";
import { FIELDS, money } from "../lib/fields";
import type { Contact } from "../lib/fields";
import { calculate } from "../lib/pricing";
import type { Pricing, Calculation } from "../lib/pricing";
import { demoContact } from "../lib/demo";
export const Route = createFileRoute("/")({ component: App });
type Row = {
  id: string;
  contact: Contact;
  status: string;
  issues: string[];
  calculation: Calculation;
  hasPdf?: boolean;
  created_at: string;
};
const labels: Record<string, string> = {
  blocked: "Adatokra vár",
  processing: "Feldolgozás",
  ready: "PDF elkészült",
  error: "Feldolgozási hiba",
  sending: "Küldés folyamatban",
  submitted: "Szolgáltatónak átadva",
  delivery_unknown: "Küldés ellenőrzendő",
};
function App() {
  const [tab, setTab] = useState("quotes"),
    [config, setConfig] = useState<Pricing | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [contacts, setContacts] = useState<Contact[]>([]),
    [selected, setSelected] = useState("KB-BEMUTATO"),
    [token, setToken] = useState(""),
    [demo, setDemo] = useState(true),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [pdfUrl, setPdfUrl] = useState(""),
    [system, setSystem] = useState<Record<string, boolean>>({});
  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });
  async function api(path: string, method = "GET", body?: unknown) {
    const r = await fetch("/api/" + path, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data;
  }
  async function load() {
    setBusy(true);
    try {
      const s = await api("settings");
      setConfig(s.config);
      setSystem(s.settings);
      setDemo(false);
      if (s.settings.database) {
        const q = await api("quotes");
        setRows(q);
        setSelected(q[0]?.id ?? "");
        const c = await api("contacts");
        setContacts(c);
      }
      setModal("");
      setMessage("A kapcsolat frissítve.");
    } catch (e) {
      setMessage(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        const calculation = calculate(d.contact, d.config);
        setRows([
          {
            id: "KB-BEMUTATO",
            contact: d.contact,
            status: "blocked",
            issues: calculation.issues,
            calculation,
            created_at: new Date().toISOString(),
          },
        ]);
      })
      .catch(() => setMessage("Az alkalmazás API-ja nem érhető el."));
  }, []);
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );
  const row = rows.find((r) => r.id === selected) ?? rows[0];
  const filtered = rows.filter(
    (r) =>
      `${r.contact.name} ${r.contact.email} ${r.contact.phone} ${r.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || r.status === filter),
  );
  async function preview(download = false) {
    if (!row) return;
    setBusy(true);
    try {
      const response = await fetch(
        demo ? "/api/demo/pdf" : `/api/quotes/${row.id}/pdf`,
        { headers: headers() },
      );
      if (!response.ok) {
        const e = await response.json();
        throw new Error(e.error);
      }
      const url = URL.createObjectURL(await response.blob());
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${row.id}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPdfUrl(url);
        setModal("pdf");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(contactId: string) {
    setBusy(true);
    try {
      const result = await api("quotes/create", "POST", { contactId });
      setRows((v) => [result, ...v.filter((x) => x.id !== result.id)]);
      setSelected(result.id);
      setTab("quotes");
      setMessage("Az ajánlat feldolgozva.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const icons = {
    quotes: FileText,
    contacts: Users,
    pricing: Layers,
    settings: Settings,
  };
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          <span className="brand-symbol">
            KB
            <span />
          </span>
          <div>
            KITCHEN<span>BOX</span>
            <small>AJÁNLATKEZELŐ</small>
          </div>
        </a>
        <div className="workspace">
          <span className="workspace-icon">K</span>
          <div>
            Kitchen Box<small>Belső munkaterület</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">MUNKATERÜLET</div>
        <nav>
          {(
            [
              ["quotes", "Árajánlatok"],
              ["contacts", "Kontaktok"],
              ["pricing", "Árazás és szabályok"],
              ["settings", "Integrációk"],
            ] as const
          ).map(([key, label]) => {
            const Icon = icons[key];
            return (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                <Icon size={18} />
                {label}
                {key === "quotes" && <b>{rows.length}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-status">
            <span className={demo ? "dot amber" : "dot"} />
            {demo ? "Bemutató mód" : "Kapcsolt munkaterület"}
          </div>
          <p>
            {demo
              ? "A mintaadatok nem kerülnek a CRM-be."
              : "Az adatokat a GHL kontaktmezőkből olvassuk."}
          </p>
          <a
            href="https://kitchen-box.hu/konfigurator/"
            target="_blank"
            rel="noreferrer"
          >
            Kitchen Box konfigurátor <ExternalLink size={13} />
          </a>
        </div>
        <div className="profile">
          <span>KB</span>
          <div>
            Kitchen Box<small>Adminisztráció</small>
          </div>
          <ShieldCheck size={17} />
        </div>
      </aside>
      <div className="main">
        <header>
          <div>
            Kitchen Box <ChevronRight size={14} />
            <strong>
              {tab === "quotes"
                ? "Árajánlatok"
                : tab === "contacts"
                  ? "Kontaktok"
                  : tab === "pricing"
                    ? "Árazás és szabályok"
                    : "Integrációk"}
            </strong>
          </div>
          <button className="connection" onClick={() => setModal("connect")}>
            <span className={demo ? "dot amber" : "dot"} />
            {demo ? "GHL csatlakoztatása" : "GHL kapcsolat"}
            <ChevronRight size={14} />
          </button>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">KITCHENBOX ADMIN</div>
              <h1>
                {tab === "quotes"
                  ? "Árajánlatok"
                  : tab === "contacts"
                    ? "Kontaktok"
                    : tab === "pricing"
                      ? "Árazás és szabályok"
                      : "Integrációk"}
              </h1>
              <p>
                {tab === "quotes"
                  ? "A konfigurációtól a személyre szabott PDF-ajánlatig."
                  : tab === "contacts"
                    ? "A Kitchen Box GHL-fiók kontaktjai és konfigurációi."
                    : tab === "pricing"
                      ? "Árak, mezőillesztések és a véglegesítés feltételei."
                      : "A biztonságos feldolgozáshoz szükséges kapcsolatok."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => (demo ? setModal("connect") : load())}
              >
                <RefreshCw size={16} />
                Frissítés
              </button>
              <button
                className="button primary"
                onClick={() => setModal("new")}
              >
                <Plus size={18} />
                Új ajánlatkérés
              </button>
            </div>
          </div>
          {message && (
            <div className="toast" role="status">
              {message}
              <button
                aria-label="Értesítés bezárása"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {demo && (
            <div className="setup-banner">
              <span className="banner-icon">
                <ShieldCheck size={21} />
              </span>
              <div>
                <strong>A munkaterület előkészítve</strong>
                <p>
                  Bemutatóadatokat látsz. A végleges ajánlat és az automatikus
                  email a hiányzó beállítások után aktiválható.
                </p>
              </div>
              <button onClick={() => setTab("settings")}>
                Beállítások <ArrowRight size={16} />
              </button>
            </div>
          )}
          {tab === "quotes" && (
            <>
              <div className="stats">
                {[
                  {
                    label: "Összes ajánlat",
                    value: demo ? "1" : rows.length,
                    sub: demo ? "Bemutató ajánlat" : "Mentett ajánlatok",
                    icon: ClipboardList,
                  },
                  {
                    label: "Adatokra vár",
                    value: rows.filter((r) => r.status === "blocked").length,
                    sub: "Ellenőrzést igényel",
                    icon: AlertCircle,
                  },
                  {
                    label: "PDF elkészült",
                    value: rows.filter((r) => r.hasPdf).length,
                    sub: "Letölthető dokumentum",
                    icon: FileText,
                  },
                  {
                    label: "Email átadva",
                    value: rows.filter((r) => r.status === "submitted").length,
                    sub: "Küldő szolgáltatónak",
                    icon: Mail,
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <div>
                      {s.label}
                      <s.icon size={17} />
                    </div>
                    <strong>{s.value.toString().padStart(2, "0")}</strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </div>
              <div className="quote-grid">
                <section className="panel list-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Ajánlatkérések</h2>
                      <span>
                        {demo
                          ? "Mintaadat · nem éles kontakt"
                          : `${rows.length} ajánlat`}
                      </span>
                    </div>
                    <span className="small-pill">
                      {demo ? "BEMUTATÓ" : "GHL"}
                    </span>
                  </div>
                  <div className="list-toolbar">
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label="Ajánlatok keresése"
                        placeholder="Keresés név, email vagy azonosító alapján"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Állapot szűrő"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Minden állapot</option>
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="table-scroll">
                    <table className="quote-table">
                      <thead>
                        <tr>
                          <th>ÜGYFÉL / KONTAKT</th>
                          <th>AJÁNLAT</th>
                          <th>ÁLLAPOT</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr
                            key={r.id}
                            className={r.id === row?.id ? "selected" : ""}
                            onClick={() => setSelected(r.id)}
                          >
                            <td>
                              <div className="contact-cell">
                                <span className="avatar">
                                  {r.contact.name
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((s) => s[0])
                                    .join("")}
                                </span>
                                <div>
                                  <strong>{r.contact.name}</strong>
                                  <small>{r.contact.email}</small>
                                  <small>{r.contact.phone}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="quote-id">{r.id}</span>
                              <small>
                                {r.calculation.ready
                                  ? money(r.calculation.gross)
                                  : "Végösszegre vár"}
                              </small>
                            </td>
                            <td>
                              <span className={"badge " + r.status}>
                                <i />
                                {labels[r.status] ?? r.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`${r.contact.name} részletei`}
                                onClick={() => setSelected(r.id)}
                              >
                                <ChevronRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && (
                      <div className="empty">
                        <Search size={25} />
                        <h3>Nincs megjeleníthető ajánlat</h3>
                        <p>
                          {query
                            ? "Próbálj más keresési feltételt."
                            : "Az új ajánlatkérések itt jelennek meg."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="list-footer">
                    <span>{filtered.length} megjelenített ajánlat</span>
                    <span>HUF · magyar forint</span>
                  </div>
                </section>
                {row && (
                  <section className="panel detail">
                    <div className="panel-title">
                      <div>
                        <h2>Ajánlat részletei</h2>
                        <span>{row.id}</span>
                      </div>
                      <FileText size={21} />
                    </div>
                    <div className="detail-body">
                      <div className="detail-contact">
                        <span className="avatar large">
                          {row.contact.name[0]}
                        </span>
                        <div>
                          <h3>{row.contact.name}</h3>
                          <p>{row.contact.email}</p>
                        </div>
                      </div>
                      <div className="detail-line">
                        <span>Telefon</span>
                        <strong>{row.contact.phone || "Nincs megadva"}</strong>
                      </div>
                      <div className="detail-line">
                        <span>Feldolgozás</span>
                        <span className={"badge " + row.status}>
                          <i />
                          {labels[row.status]}
                        </span>
                      </div>
                      <div className="section-label">
                        KIVÁLASZTOTT KONFIGURÁCIÓ
                      </div>
                      <div className="configuration">
                        {FIELDS.map((f) => (
                          <div key={f.key}>
                            <span>{f.label}</span>
                            <strong>
                              {Array.isArray(row.contact.fields[f.key])
                                ? (row.contact.fields[f.key] as string[]).join(
                                    ", ",
                                  ) || "Nincs kiválasztva"
                                : row.contact.fields[f.key] || "Nincs megadva"}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="delivery">
                        <MapPin size={17} />
                        <div>
                          <strong>Kiszállítás</strong>
                          <p>{row.contact.fullAddress || "Célcímre vár"}</p>
                          <small>
                            {row.contact.roadKm !== undefined
                              ? `${row.contact.roadKm} km × 280 Ft · ${row.contact.roadKmSource}`
                              : "Közúti távolság lekérdezésre vár"}
                          </small>
                        </div>
                      </div>
                      <div className="total">
                        <span>Ajánlat végösszege</span>
                        <strong>
                          {row.calculation.ready
                            ? money(row.calculation.gross)
                            : "Még nem végleges"}
                        </strong>
                      </div>
                      {row.issues.length > 0 && (
                        <div className="issues">
                          <strong>
                            <AlertCircle size={15} />A véglegesítéshez szükséges
                          </strong>
                          <ul>
                            {row.issues.map((i) => (
                              <li key={i}>{i}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="pdf-actions">
                        <button
                          className="button secondary"
                          onClick={() => preview()}
                          disabled={busy}
                        >
                          <FileText size={16} />
                          PDF előnézet
                        </button>
                        <button
                          className="button primary"
                          aria-label="PDF letöltése"
                          onClick={() => preview(true)}
                          disabled={busy}
                        >
                          <ArrowDownToLine size={17} />
                        </button>
                      </div>
                      <button
                        className="button send-button"
                        disabled={
                          demo ||
                          row.status !== "ready" ||
                          !system.sending ||
                          !system.email ||
                          busy
                        }
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(`quotes/${row.id}/send`, "POST");
                            await load();
                          } catch (e) {
                            setMessage((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Mail size={16} />
                        Ajánlat küldése emailben
                      </button>
                      <p className="safe-note">
                        <LockKeyhole size={12} />
                        {demo || !system.sending
                          ? "A küldés jelenleg nincs engedélyezve."
                          : "Csak teljes, ellenőrzött ajánlat küldhető."}
                      </p>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
          {tab === "contacts" && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Kontaktok</h2>
                  <span>
                    Email: contact.email · Telefon: contact.phone · Cím:
                    contact.full_address
                  </span>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>NÉV / EMAIL / TELEFON</th>
                      {FIELDS.map((f) => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(demo ? [demoContact] : contacts).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <small>{c.email}</small>
                          <small>{c.phone}</small>
                        </td>
                        {FIELDS.map((f) => (
                          <td key={f.key}>
                            {Array.isArray(c.fields[f.key])
                              ? (c.fields[f.key] as string[]).join(", ")
                              : c.fields[f.key] || "–"}
                          </td>
                        ))}
                        <td>
                          <button
                            className="button secondary"
                            disabled={demo || busy}
                            onClick={() => generate(c.id)}
                          >
                            Ajánlat készítése
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!demo && !contacts.length && (
                <div className="empty">
                  Nincs betöltött kontakt. Frissítsd a GHL-kapcsolatot.
                </div>
              )}
            </section>
          )}
          {tab === "pricing" && config && (
            <PricingEditor
              config={config}
              demo={demo}
              busy={busy}
              onSave={async (c) => {
                setBusy(true);
                try {
                  const result = await api("settings", "PUT", c);
                  setConfig(result.config);
                  setMessage("Az árlista új verzióként mentve.");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          {tab === "settings" && (
            <>
              <div className="integrations">
                {[
                  {
                    name: "GoHighLevel",
                    text: "Natív kontaktmezők olvasása és kontakt upsert. A kontakt emailje az ajánlat címzettje.",
                    key: "ghl",
                    tag: "CRM",
                  },
                  {
                    name: "Közúti útvonal",
                    text: "Google Routes API · Békéscsaba, Bartók Béla út 37A → contact.full_address. Egyszeres táv × 280 Ft/km.",
                    key: "routing",
                    tag: "ÚTVONAL",
                  },
                  {
                    name: "Adatbázis",
                    text: "Supabase PostgreSQL · tartós állapotok, PDF-tárolás és atomikus duplikációvédelem.",
                    key: "database",
                    tag: "ADATOK",
                  },
                  {
                    name: "Email küldés",
                    text: "Resend · ellenőrzött feladói domain, PDF-melléklet. A küldés külön kapcsolóval engedélyezhető.",
                    key: "email",
                    tag: "EMAIL",
                  },
                ].map((x) => (
                  <section className="panel integration" key={x.key}>
                    <div className="integration-top">
                      <span className="small-pill">{x.tag}</span>
                      <span
                        className={
                          "badge " + (system[x.key] ? "ready" : "blocked")
                        }
                      >
                        <i />
                        {system[x.key] ? "Beállítva" : "Beállításra vár"}
                      </span>
                    </div>
                    <h2>{x.name}</h2>
                    <p>{x.text}</p>
                    <div className="integration-footer">
                      <ShieldCheck size={15} />
                      Kizárólag szerveroldali hozzáférés
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel setup-guide">
                <h2>Élesítés előtti beállítások</h2>
                <p>
                  A szerver titkait a Vibe Secrets felületén vagy a
                  futtatókörnyezet környezeti változóiban add meg. A kliens nem
                  tárol GHL-, adatbázis-, útvonal- vagy email API-kulcsot.
                </p>
                <div className="steps">
                  {[
                    "GHL token és webhook hitelesítés beállítása",
                    "Supabase kapcsolat és SQL migráció futtatása",
                    "ÁFA, grill-szabály és kiállítói adatok jóváhagyása",
                    "Google Routes és a feladói domain hitelesítése",
                  ].map((s, i) => (
                    <div key={s}>
                      <span>{i + 1}</span>
                      {s}
                    </div>
                  ))}
                </div>
                <button
                  className="button primary"
                  onClick={() => setModal("connect")}
                >
                  Admin kapcsolat megnyitása <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>Kitchen Box · Ajánlatkezelő</span>
            <span>
              <ShieldCheck size={13} />
              Véglegesítés csak ellenőrzött adatokkal
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal("")}>
          <section
            className={"modal " + (modal === "pdf" ? "pdf-modal" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "new"
                ? "Új ajánlatkérés"
                : modal === "pdf"
                  ? "PDF előnézet"
                  : "Admin kapcsolat"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>
                {modal === "new"
                  ? "Új ajánlatkérés"
                  : modal === "pdf"
                    ? "PDF előnézet"
                    : "Admin kapcsolat"}
              </h2>
              <button
                className="icon-button"
                aria-label="Bezárás"
                onClick={() => setModal("")}
              >
                <X size={20} />
              </button>
            </div>
            {modal === "connect" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
              >
                <p>
                  A szerveren beállított admin hozzáférési tokent add meg. A
                  token csak az aktuális munkamenet memóriájában marad.
                </p>
                <label>
                  Admin token
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    autoComplete="off"
                    minLength={32}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  {busy ? "Csatlakozás…" : "Csatlakozás"}
                </button>
              </form>
            )}
            {modal === "new" && (
              <ContactForm
                demo={demo}
                busy={busy}
                onSubmit={async (input) => {
                  setBusy(true);
                  try {
                    const result = await api("contacts", "POST", input);
                    setRows((v) => [
                      result,
                      ...v.filter((r) => r.id !== result.id),
                    ]);
                    setSelected(result.id);
                    setModal("");
                    setTab("quotes");
                    setMessage(
                      "A kontakt mentve a GHL-ben, az ajánlat feldolgozva.",
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {modal === "pdf" && (
              <iframe title="Kitchenbox PDF előnézet" src={pdfUrl} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function ContactForm({
  demo,
  busy,
  onSubmit,
}: {
  demo: boolean;
  busy: boolean;
  onSubmit: (c: Omit<Contact, "id">) => void;
}) {
  const [fields, setFields] = useState<Record<string, string | string[]>>({});
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    onSubmit({
      name: String(d.get("name")),
      email: String(d.get("email")),
      phone: String(d.get("phone")),
      fullAddress: String(d.get("fullAddress")),
      fields,
    });
  }
  return (
    <form onSubmit={submit}>
      <p>
        {demo
          ? "Űrlapelőnézet. GHL-kapcsolat után a mentés létrehozza vagy frissíti a kontaktot."
          : "A mentés létrehozza vagy frissíti a GHL kontaktot, majd feldolgozza az ajánlatot."}
      </p>
      <div className="form-grid">
        <label>
          Teljes név
          <input name="name" required maxLength={200} />
        </label>
        <label>
          Email · contact.email
          <input name="email" type="email" required />
        </label>
        <label>
          Telefon · contact.phone
          <input name="phone" type="tel" />
        </label>
        <label>
          Kiszállítási cím · contact.full_address
          <input
            name="fullAddress"
            required
            placeholder="Irányítószám, település, utca, házszám"
          />
        </label>
        {FIELDS.map((f) =>
          f.note ? (
            <label className="wide" key={f.key}>
              {f.label}
              <textarea
                value={(fields[f.key] as string) || ""}
                onChange={(e) =>
                  setFields({ ...fields, [f.key]: e.target.value })
                }
              />
            </label>
          ) : f.multi ? (
            <fieldset className="wide" key={f.key}>
              <legend>{f.label}</legend>
              {f.options.map((v) => (
                <label className="check-label" key={v}>
                  <input
                    type="checkbox"
                    checked={((fields[f.key] as string[]) || []).includes(v)}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        [f.key]: e.target.checked
                          ? [...((fields[f.key] as string[]) || []), v]
                          : (fields[f.key] as string[]).filter((x) => x !== v),
                      })
                    }
                  />
                  {v}
                </label>
              ))}
            </fieldset>
          ) : (
            <label key={f.key}>
              {f.label}
              <select
                required={f.key !== "contact.gzgrill"}
                value={(fields[f.key] as string) || ""}
                onChange={(e) =>
                  setFields({ ...fields, [f.key]: e.target.value })
                }
              >
                <option value="">Válassz…</option>
                {f.options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
      <button className="button primary" type="submit" disabled={demo || busy}>
        {busy ? "Feldolgozás…" : "Kontakt mentése és ajánlat készítése"}
      </button>
      {demo && (
        <small className="form-help">
          A mentéshez csatlakoztasd az admin munkamenetet és a GHL-t.
        </small>
      )}
    </form>
  );
}
function PricingEditor({
  config,
  demo,
  busy,
  onSave,
}: {
  config: Pricing;
  demo: boolean;
  busy: boolean;
  onSave: (c: Pricing) => void;
}) {
  const [draft, setDraft] = useState(config);
  useEffect(() => setDraft(config), [config]);
  const change = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });
  return (
    <section className="panel pricing">
      <div className="panel-title">
        <div>
          <h2>Árlista és kalkuláció</h2>
          <span>
            Alapár + gázgrill + kiválasztott extrák + közúti km × 280 Ft
          </span>
        </div>
        <span className="badge blocked">
          <i />
          {draft.approved ? "Jóváhagyott" : "Jóváhagyásra vár"}
        </span>
      </div>
      <div className="pricing-body">
        <div className="form-grid">
          <label>
            Alap egységár (Ft)
            <input
              type="number"
              min="0"
              value={draft.baseAmount ?? ""}
              onChange={(e) =>
                change(
                  "baseAmount",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Árak jellege
            <select
              value={draft.basis ?? ""}
              onChange={(e) => change("basis", e.target.value || null)}
            >
              <option value="">Tisztázásra vár</option>
              <option value="gross">Bruttó</option>
              <option value="net">Nettó</option>
            </select>
          </label>
          <label>
            ÁFA (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.vatBps === null ? "" : draft.vatBps / 100}
              onChange={(e) =>
                change(
                  "vatBps",
                  e.target.value === ""
                    ? null
                    : Math.round(Number(e.target.value) * 100),
                )
              }
            />
          </label>
          <label>
            Gázgrill szabály
            <select
              value={draft.grillMode ?? ""}
              onChange={(e) => change("grillMode", e.target.value || null)}
            >
              <option value="">Tisztázásra vár</option>
              <option value="always">Mindig kötelező kiválasztani</option>
              <option value="selected">Csak kiválasztáskor</option>
            </select>
          </label>
          <label>
            Ajánlat érvényessége (nap)
            <input
              type="number"
              value={draft.validDays ?? ""}
              onChange={(e) =>
                change(
                  "validDays",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Indulási cím
            <input
              value={draft.delivery.origin}
              onChange={(e) =>
                change("delivery", {
                  ...draft.delivery,
                  origin: e.target.value,
                })
              }
            />
          </label>
          {Object.entries({
            name: "Kiállító neve",
            address: "Kiállító címe",
            taxId: "Adószám",
            email: "Kapcsolati email",
          }).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                value={draft.seller[k as keyof typeof draft.seller]}
                onChange={(e) =>
                  change("seller", { ...draft.seller, [k]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <div className="price-note">
          A 0 Ft az adott választás külön felár nélküli megjelenítését jelenti.
          Az üres ár ismeretlen; kiválasztása blokkolja a véglegesítést.
        </div>
        {draft.fields.map((field, i) => (
          <div className="price-group" key={field.key}>
            <div>
              <h3>{field.label}</h3>
              <code>{"{{" + field.key + "}}"}</code>
              <label className="field-id">
                GHL mezőazonosító
                <input
                  value={field.fieldId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      fields: draft.fields.map((f, j) =>
                        j === i ? { ...f, fieldId: e.target.value } : f,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <div className="price-rules">
              {field.rules.map((rule, j) => (
                <label key={rule.value}>
                  <span>{rule.value}</span>
                  <div>
                    <input
                      aria-label={`${field.label}: ${rule.value} ár`}
                      type="number"
                      min="0"
                      placeholder="Ár hiányzik"
                      value={rule.amount ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          fields: draft.fields.map((f, fi) =>
                            fi === i
                              ? {
                                  ...f,
                                  rules: f.rules.map((r, ri) =>
                                    ri === j
                                      ? {
                                          ...r,
                                          amount:
                                            e.target.value === ""
                                              ? null
                                              : Number(e.target.value),
                                        }
                                      : r,
                                  ),
                                }
                              : f,
                          ),
                        })
                      }
                    />
                    <small>Ft</small>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
        <label>
          Megjegyzés GHL mezőazonosító · contact.megjegyzs
          <input
            value={draft.noteFieldId}
            onChange={(e) => change("noteFieldId", e.target.value)}
          />
        </label>
        <label>
          Ajánlati feltételek
          <textarea
            rows={5}
            value={draft.terms}
            onChange={(e) => change("terms", e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.approved}
            onChange={(e) => change("approved", e.target.checked)}
          />
          Az árlistát és a kalkulációs szabályokat jóváhagyom
        </label>
        <button
          className="button primary"
          disabled={demo || busy}
          onClick={() => onSave(draft)}
        >
          <Check size={17} />
          Árlista mentése
        </button>
        {demo && (
          <small className="form-help">
            Bemutató módban szerkeszthető előnézet; mentéshez admin kapcsolat
            szükséges.
          </small>
        )}
      </div>
    </section>
  );
}
