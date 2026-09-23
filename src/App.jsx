import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Minus, ArrowLeft, Receipt, Users, Wallet, CreditCard, X,
  ChevronRight, Search, RefreshCw, Trash2, Check, ClipboardList, WifiOff,
  UtensilsCrossed, Pencil, LogOut, Printer, FileSpreadsheet, MoreHorizontal,
  KeyRound, ShieldCheck,
} from "lucide-react";
import { fmt, orderedCategories, catColor } from "./menu";
import * as db from "./db";
import { printRoundTicket, printBillReceipt, findLocalPrinters } from "./print";
import { buildOverzichtRows, exportOverzichtXlsx } from "./overzicht";

const AUTH_KEY = "eetfestijn-auth";

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch { return null; }
  });

  if (!auth) return <LoginScreen onLogin={(u) => { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); setAuth(u); }} />;

  return <MainApp auth={auth} onLogout={() => { localStorage.removeItem(AUTH_KEY); setAuth(null); }} />;
}

// ---------------------------------------------------------------------------
function LoginScreen({ onLogin }) {
  const [names, setNames] = useState([]);
  const [naam, setNaam] = useState("");
  const [paswoord, setPaswoord] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.fetchUsers().then((rows) => setNames(rows.map((r) => r.naam))).catch(() => setNames([]));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await db.login(naam.trim(), paswoord);
      if (!user) setError("Foutieve naam of wachtwoord.");
      else onLogin({ naam: user.naam, categorie: user.categorie });
    } catch (e2) {
      console.error(e2);
      setError("Kon niet verbinden met Supabase. Controleer je instellingen.");
    }
    setBusy(false);
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#FAF6F0", minHeight: "100vh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ color: "#6B1E2B", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Eetfestijn</div>
        <div style={{ color: "#2B211D", fontSize: 26, fontWeight: 800 }}>Aanmelden</div>
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #EEE4D8", borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Naam</div>
        <input value={naam} onChange={(e) => setNaam(e.target.value)} list="namen-lijst" placeholder="Kies of typ je naam" style={inputStyle} />
        <datalist id="namen-lijst">{names.map((n) => <option key={n} value={n} />)}</datalist>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 14 }}>Wachtwoord</div>
        <input value={paswoord} onChange={(e) => setPaswoord(e.target.value)} type="password" placeholder="••••••" style={inputStyle} />

        {error && <div style={{ color: "#7A2530", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <button type="submit" disabled={busy || !naam.trim() || !paswoord} style={{ ...primaryBtnStyle(!busy && naam.trim() && paswoord), marginTop: 18 }}>
          {busy ? "Bezig…" : "Inloggen"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
function MainApp({ auth, onLogout }) {
  const isBeheerder = auth.categorie === "Beheerder";

  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [itemsBySession, setItemsBySession] = useState({});
  const [menu, setMenu] = useState([]);
  const [users, setUsers] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [tab, setTab] = useState("tafels"); // tafels | geschiedenis | menu | gebruikers | printers | overzicht
  const [moreOpen, setMoreOpen] = useState(false);
  const [view, setView] = useState("home"); // home | order | bill | detail
  const [activeId, setActiveId] = useState(null);
  const [cart, setCart] = useState({});
  const [catFilter, setCatFilter] = useState(null);
  const [query, setQuery] = useState("");
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [menuModal, setMenuModal] = useState(null);
  const [userModal, setUserModal] = useState(null);
  const [printerModal, setPrinterModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => orderedCategories(menu), [menu]);
  const activePrinter = useMemo(() => printers.find((p) => p.active) || null, [printers]);

  const loadAll = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [open, hist, menuRows, userRows, printerRows] = await Promise.all([
        db.fetchOpenSessions(),
        db.fetchHistorySessions(),
        db.fetchMenu(),
        isBeheerder ? db.fetchUsers() : Promise.resolve([]),
        isBeheerder ? db.fetchPrinters() : Promise.resolve([]),
      ]);
      setSessions(open);
      setHistory(hist);
      setMenu(menuRows);
      setUsers(userRows);
      setPrinters(printerRows);
      const allIds = [...open.map((s) => s.id), ...hist.map((s) => s.id)];
      const items = await db.fetchOrderItemsForSessions(allIds);
      const grouped = {};
      for (const row of items) (grouped[row.session_id] = grouped[row.session_id] || []).push(row);
      setItemsBySession(grouped);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon geen verbinding maken met Supabase. Controleer je .env instellingen en of de tabellen bestaan.");
    }
    setLoading(false);
  }, [isBeheerder]);

  useEffect(() => {
    loadAll();
    const unsubscribe = db.subscribeToChanges(() => loadAll());
    return unsubscribe;
  }, [loadAll]);

  useEffect(() => {
    if (!catFilter && categories.length > 0) setCatFilter(categories[0]);
  }, [categories, catFilter]);

  // Opnemer-rol mag enkel de Tafels-tab zien
  useEffect(() => {
    if (!isBeheerder && tab !== "tafels") setTab("tafels");
  }, [isBeheerder, tab]);

  const activeSession = sessions.find((s) => s.id === activeId) || null;
  const historySession = history.find((s) => s.id === activeId) || null;
  const activeItems = activeSession ? itemsBySession[activeSession.id] || [] : [];

  async function handleCreateSession(tafelNummer, tafelLetter, naam) {
    setBusy(true);
    try {
      const session = await db.createSession(tafelNummer, tafelLetter, naam, auth.naam);
      await loadAll();
      setActiveId(session.id);
      setCart({});
      setQuery("");
      setView("order");
      setNewTableOpen(false);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon tafel niet aanmaken.");
    }
    setBusy(false);
  }

  function updateCart(item, delta) {
    setCart((c) => {
      const next = { ...c };
      const cur = next[item.id]?.qty || 0;
      const nv = cur + delta;
      if (nv <= 0) delete next[item.id];
      else next[item.id] = { name: item.name, price: item.price, category: item.category, qty: nv };
      return next;
    });
  }

  async function submitRound() {
    if (!activeSession || Object.keys(cart).length === 0) return;
    setBusy(true);
    try {
      const existingRounds = new Set(
        (itemsBySession[activeSession.id] || []).map((r) => r.round_label).filter((l) => l && l.startsWith("Ronde"))
      );
      const label = `Ronde ${existingRounds.size + 1}`;
      const cartEntries = Object.entries(cart);
      await db.insertRound(activeSession.id, cart, label, auth.naam);
      setCart({});
      await loadAll();
      try {
        await printRoundTicket(activePrinter, {
          tafelLabel: db.tafelLabel(activeSession),
          naam: activeSession.naam,
          opnemer: auth.naam,
          items: cartEntries,
        });
      } catch (printErr) {
        console.error(printErr);
        setErrorMsg(`Ronde opgeslagen, maar printen mislukt: ${printErr.message || printErr}`);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon bestelling niet versturen.");
    }
    setBusy(false);
  }

  async function adjustBillLine(itemId, name, price, category, delta) {
    if (!activeSession) return;
    try {
      await db.insertCorrection(activeSession.id, itemId, name, price, category, delta, auth.naam);
      await loadAll();
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon lijn niet aanpassen.");
    }
  }

  async function handleDeleteSession(id) {
    setBusy(true);
    try {
      await db.deleteSession(id);
      await loadAll();
      setView("home");
      setActiveId(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon tafel niet verwijderen.");
    }
    setBusy(false);
  }

  async function handleFinalize(session, paymentMethod, cashReceived, total) {
    setBusy(true);
    try {
      await db.finalizeSession(session.id, paymentMethod, cashReceived, total);
      await loadAll();
      setView("home");
      setActiveId(null);
      setTab("tafels");
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon niet afrekenen.");
    }
    setBusy(false);
  }

  async function handleSaveMenuItem(fields) {
    setBusy(true);
    try {
      if (menuModal && menuModal.id) await db.updateMenuItem(menuModal.id, fields);
      else await db.createMenuItem(fields);
      await loadAll();
      setMenuModal(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon item niet opslaan.");
    }
    setBusy(false);
  }

  async function handleDeleteMenuItem(id) {
    if (!window.confirm("Dit item verwijderen uit het menu?")) return;
    setBusy(true);
    try {
      await db.deleteMenuItem(id);
      await loadAll();
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon item niet verwijderen.");
    }
    setBusy(false);
  }

  async function handleSaveUser(fields) {
    setBusy(true);
    try {
      if (userModal && userModal.id) await db.updateUser(userModal.id, fields);
      else await db.createUser(fields);
      await loadAll();
      setUserModal(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon gebruiker niet opslaan.");
    }
    setBusy(false);
  }

  async function handleDeleteUser(id) {
    if (!window.confirm("Deze gebruiker verwijderen?")) return;
    setBusy(true);
    try {
      await db.deleteUser(id);
      await loadAll();
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon gebruiker niet verwijderen.");
    }
    setBusy(false);
  }

  async function handleSavePrinter(fields) {
    setBusy(true);
    try {
      if (printerModal && printerModal.id) await db.updatePrinter(printerModal.id, fields);
      else await db.createPrinter(fields);
      await loadAll();
      setPrinterModal(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon printer niet opslaan.");
    }
    setBusy(false);
  }

  async function handleDeletePrinter(id) {
    if (!window.confirm("Deze printer verwijderen?")) return;
    setBusy(true);
    try {
      await db.deletePrinter(id);
      await loadAll();
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon printer niet verwijderen.");
    }
    setBusy(false);
  }

  async function handleSetActivePrinter(id) {
    setBusy(true);
    try {
      await db.setActivePrinter(id);
      await loadAll();
    } catch (e) {
      console.error(e);
      setErrorMsg("Kon printer niet activeren.");
    }
    setBusy(false);
  }

  function handleQueryChange(v) { setQuery(v); }

  const overzichtRows = useMemo(() => buildOverzichtRows(history, itemsBySession), [history, itemsBySession]);

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "#6B1E2B", fontWeight: 700 }}>Laden…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      {errorMsg && (
        <div style={{ background: "#F8D7DA", color: "#7A2530", fontSize: 12.5, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <WifiOff size={14} /> {errorMsg}
        </div>
      )}

      {view === "home" && (
        <HomeShell
          auth={auth}
          onLogout={onLogout}
          sessions={sessions}
          history={history}
          itemsBySession={itemsBySession}
          menu={menu}
          categories={categories}
          users={users}
          printers={printers}
          overzichtRows={overzichtRows}
          tab={tab}
          setTab={setTab}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          busy={busy}
          onRefresh={loadAll}
          onOpenSession={(id) => { setActiveId(id); setCart({}); setQuery(""); setView("order"); }}
          onOpenHistory={(id) => { setActiveId(id); setView("detail"); }}
          onNewTable={() => setNewTableOpen(true)}
          onEditMenuItem={(item) => setMenuModal(item)}
          onNewMenuItem={() => setMenuModal({})}
          onDeleteMenuItem={handleDeleteMenuItem}
          onEditUser={(u) => setUserModal(u)}
          onNewUser={() => setUserModal({})}
          onDeleteUser={handleDeleteUser}
          onEditPrinter={(p) => setPrinterModal(p)}
          onNewPrinter={() => setPrinterModal({})}
          onDeletePrinter={handleDeletePrinter}
          onSetActivePrinter={handleSetActivePrinter}
        />
      )}

      {view === "order" && activeSession && (
        <OrderScreen
          session={activeSession}
          items={activeItems}
          menu={menu}
          categories={categories}
          cart={cart}
          query={query}
          setQuery={handleQueryChange}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          onUpdateCart={updateCart}
          onSubmitRound={submitRound}
          onBack={() => { setView("home"); setActiveId(null); }}
          onGoBill={() => setView("bill")}
          onDelete={() => handleDeleteSession(activeSession.id)}
        />
      )}

      {view === "bill" && activeSession && (
        <BillScreen session={activeSession} items={activeItems} activePrinter={activePrinter} onBack={() => setView("order")} onAdjust={adjustBillLine} onFinalize={handleFinalize} />
      )}

      {view === "detail" && historySession && (
        <DetailScreen session={historySession} items={itemsBySession[historySession.id] || []} onBack={() => { setActiveId(null); setView("home"); }} />
      )}

      {newTableOpen && <NewTableModal existing={sessions} onClose={() => setNewTableOpen(false)} onCreate={handleCreateSession} />}
      {menuModal !== null && <MenuItemModal item={menuModal} categories={categories} onClose={() => setMenuModal(null)} onSave={handleSaveMenuItem} />}
      {userModal !== null && <UserModal item={userModal} onClose={() => setUserModal(null)} onSave={handleSaveUser} />}
      {printerModal !== null && <PrinterModal item={printerModal} beheerders={users.filter((u) => u.categorie === "Beheerder")} onClose={() => setPrinterModal(null)} onSave={handleSavePrinter} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#FAF6F0", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", color: "#2B211D", paddingBottom: 78 }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
const TAB_TITLES = { tafels: "Tafels", geschiedenis: "Geschiedenis", menu: "Menu beheren", gebruikers: "Gebruikers", printers: "Printers", overzicht: "Overzicht" };
const MORE_TABS = [
  { id: "geschiedenis", label: "Geschiedenis", icon: <ClipboardList size={18} /> },
  { id: "menu", label: "Menu", icon: <UtensilsCrossed size={18} /> },
  { id: "gebruikers", label: "Beheer (gebruikers)", icon: <ShieldCheck size={18} /> },
  { id: "printers", label: "Printers", icon: <Printer size={18} /> },
  { id: "overzicht", label: "Overzicht", icon: <FileSpreadsheet size={18} /> },
];

function HomeShell(props) {
  const {
    auth, onLogout, sessions, history, itemsBySession, menu, categories, users, printers, overzichtRows,
    tab, setTab, moreOpen, setMoreOpen, busy, onRefresh, onOpenSession, onOpenHistory, onNewTable,
    onEditMenuItem, onNewMenuItem, onDeleteMenuItem, onEditUser, onNewUser, onDeleteUser,
    onEditPrinter, onNewPrinter, onDeletePrinter, onSetActivePrinter,
  } = props;
  const isBeheerder = auth.categorie === "Beheerder";

  const fabAction = { tafels: onNewTable, menu: onNewMenuItem, gebruikers: onNewUser, printers: onNewPrinter }[tab];
  const showFab = ["tafels", "menu", "gebruikers", "printers"].includes(tab);

  return (
    <div>
      <div style={{ background: "#6B1E2B", padding: "20px 18px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#E8C88A", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Eetfestijn · {auth.naam}</div>
            <div style={{ color: "#FFF", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{TAB_TITLES[tab]}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tab === "overzicht" && (
              <button onClick={() => exportOverzichtXlsx(overzichtRows)} style={iconBtnStyle("#8A2E3D")}><FileSpreadsheet size={18} color="#F4E4C8" /></button>
            )}
            <button onClick={onRefresh} style={iconBtnStyle("#8A2E3D")}><RefreshCw size={18} color="#F4E4C8" /></button>
            <button onClick={onLogout} style={iconBtnStyle("#8A2E3D")}><LogOut size={18} color="#F4E4C8" /></button>
          </div>
        </div>
      </div>

      {tab === "tafels" && (
        <div style={{ padding: "14px 18px 100px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <TabButton active={true} onClick={() => {}} label={`Open (${sessions.length})`} />
          </div>
          {sessions.length === 0 && <EmptyState icon={<Users size={30} color="#B8A99A" />} text="Nog geen open tafels. Tik op + om een tafel te starten." />}
          {sessions.map((s) => {
            const items = itemsBySession[s.id] || [];
            const total = db.amountFromItems(items);
            const nItems = items.reduce((a, r) => a + r.qty, 0);
            const rondes = new Set(items.map((r) => r.round_label)).size;
            return (
              <div key={s.id} onClick={() => onOpenSession(s.id)} style={cardStyle}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F4E4C8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#6B1E2B", fontSize: 14 }}>
                  {db.tafelLabel(s)}
                </div>
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{s.naam}</div>
                  <div style={{ fontSize: 12.5, color: "#8A7C6E", marginTop: 2 }}>{nItems} item{nItems === 1 ? "" : "s"} · {rondes} ronde{rondes === 1 ? "" : "s"}{s.opnemer ? ` · ${s.opnemer}` : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{fmt(total)}</div>
                  <ChevronRight size={16} color="#C7B8A8" style={{ marginLeft: "auto" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "geschiedenis" && <HistoryList history={history} onOpen={onOpenHistory} />}
      {tab === "menu" && <MenuScreen menu={menu} categories={categories} onEdit={onEditMenuItem} onDelete={onDeleteMenuItem} />}
      {tab === "gebruikers" && <UsersScreen users={users} onEdit={onEditUser} onDelete={onDeleteUser} />}
      {tab === "printers" && <PrintersScreen printers={printers} onEdit={onEditPrinter} onDelete={onDeletePrinter} onSetActive={onSetActivePrinter} />}
      {tab === "overzicht" && <OverzichtScreen rows={overzichtRows} />}

      {showFab && (
        <button onClick={fabAction} style={fabStyle}><Plus size={26} color="#fff" /></button>
      )}

      {busy && <div style={{ position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)", background: "#2B211D", color: "#fff", fontSize: 11.5, padding: "5px 12px", borderRadius: 20, opacity: 0.85 }}>Bezig…</div>}

      <BottomNav tab={tab} setTab={setTab} isBeheerder={isBeheerder} moreOpen={moreOpen} setMoreOpen={setMoreOpen} />
    </div>
  );
}

function PrintersScreen({ printers, onEdit, onDelete, onSetActive }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const activePrinter = printers.find((p) => p.active);

  async function testConnection(p) {
    setTesting(p.id);
    setTestResult(null);
    try {
      const found = await findLocalPrinters(p.qz_host);
      setTestResult({ ok: true, id: p.id, msg: `Verbonden. ${found.length} printer(s) gevonden op dit toestel.` });
    } catch (e) {
      setTestResult({ ok: false, id: p.id, msg: e.message || String(e) });
    }
    setTesting(false);
  }

  return (
    <div style={{ padding: "8px 18px 100px" }}>
      <div style={{ background: "#FBF1E4", border: "1px solid #EEDDBB", borderRadius: 12, padding: 12, fontSize: 12.5, color: "#6B1E2B", marginBottom: 14, lineHeight: 1.5 }}>
        Printen loopt via <b>QZ Tray</b>, geïnstalleerd op de PC van de beheerder. Zet hieronder de
        printer die overeenkomt met de naam in QZ Tray, en markeer er één als <b>actief</b> — die
        wordt gebruikt bij "Ronde versturen" en bij "Print rekening", vanaf eender welk toestel
        (ook de iPads van de opnemers), zolang ze op hetzelfde wifi-netwerk zitten.
      </div>
      {activePrinter && (
        <div style={{ background: "#EAF2EE", border: "1px solid #CFE6DA", borderRadius: 12, padding: 12, fontSize: 12.5, color: "#2E7D6B", marginBottom: 14, fontWeight: 700 }}>
          Actieve printer: {activePrinter.naam}
        </div>
      )}
      {printers.length === 0 && <EmptyState icon={<Printer size={30} color="#B8A99A" />} text="Nog geen printers geregistreerd." />}
      {printers.map((p) => (
        <div key={p.id} style={{ background: "#fff", border: p.active ? "2px solid #2E7D6B" : "1px solid #EEE4D8", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.naam}{p.active && <span style={{ color: "#2E7D6B", fontWeight: 800, fontSize: 11, marginLeft: 6 }}>ACTIEF</span>}</div>
              <div style={{ fontSize: 12.5, color: "#8A7C6E" }}>Beheerder: {p.beheerder}{p.omschrijving ? ` · ${p.omschrijving}` : ""}</div>
              <div style={{ fontSize: 12, color: "#B8A99A" }}>QZ-adres: {p.qz_host || "(dit toestel / localhost)"}</div>
            </div>
            <button onClick={() => onEdit(p)} style={{ ...stepBtnStyle(false), width: 30, height: 30, marginRight: 6 }}><Pencil size={13} /></button>
            <button onClick={() => onDelete(p.id)} style={{ ...stepBtnStyle(false), width: 30, height: 30, background: "#F8D7DA", color: "#7A2530" }}><Trash2 size={13} /></button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {!p.active && (
              <button onClick={() => onSetActive(p.id)} style={{ flex: 1, border: "1px solid #EEE4D8", background: "#FBF6EE", borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 700, color: "#6B1E2B", cursor: "pointer" }}>Maak actief</button>
            )}
            <button onClick={() => testConnection(p)} disabled={testing === p.id} style={{ flex: 1, border: "1px solid #EEE4D8", background: "#FBF6EE", borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 700, color: "#6B1E2B", cursor: "pointer" }}>
              {testing === p.id ? "Bezig…" : "Test verbinding"}
            </button>
          </div>
          {testResult && testResult.id === p.id && (
            <div style={{ marginTop: 6, fontSize: 12, color: testResult.ok ? "#2E7D6B" : "#7A2530" }}>{testResult.msg}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function UsersScreen({ users, onEdit, onDelete }) {
  return (
    <div style={{ padding: "8px 18px 100px" }}>
      {users.length === 0 && <EmptyState icon={<ShieldCheck size={30} color="#B8A99A" />} text="Nog geen gebruikers." />}
      {users.map((u) => (
        <div key={u.id} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EEE4D8", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: u.categorie === "Beheerder" ? "#F4E4C8" : "#EAF2EE", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            <KeyRound size={15} color={u.categorie === "Beheerder" ? "#6B1E2B" : "#2E7D6B"} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{u.naam}</div>
            <div style={{ fontSize: 12.5, color: "#8A7C6E" }}>{u.categorie}</div>
          </div>
          <button onClick={() => onEdit(u)} style={{ ...stepBtnStyle(false), width: 30, height: 30, marginRight: 6 }}><Pencil size={13} /></button>
          <button onClick={() => onDelete(u.id)} style={{ ...stepBtnStyle(false), width: 30, height: 30, background: "#F8D7DA", color: "#7A2530" }}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function OverzichtScreen({ rows }) {
  const cols = ["Datum", "Tafel", "Naam", "Item", "Aantal", "Bedrag", "Betalingswijze", "In_Kas", "Dag", "Categorie", "AM/PM"];
  return (
    <div style={{ padding: "8px 18px 100px" }}>
      {rows.length === 0 && <EmptyState icon={<FileSpreadsheet size={30} color="#B8A99A" />} text="Nog geen afgerekende bestellingen om te tonen." />}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #EEE4D8", borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr>{cols.map((c) => <th key={c} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #EEE4D8", color: "#8A7C6E", whiteSpace: "nowrap" }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c} style={{ padding: "7px 10px", borderBottom: "1px solid #F5EEE3", whiteSpace: "nowrap" }}>{c === "Bedrag" || c === "In_Kas" ? fmt(r[c]) : r[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MenuScreen({ menu, categories, onEdit, onDelete }) {
  return (
    <div style={{ padding: "8px 18px 100px" }}>
      {menu.length === 0 && <EmptyState icon={<UtensilsCrossed size={30} color="#B8A99A" />} text="Nog geen menu-items. Tik op + om er één toe te voegen." />}
      {categories.map((cat) => {
        const rows = menu.filter((m) => m.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: catColor(categories, cat) }} />
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8A7C6E", textTransform: "uppercase", letterSpacing: 0.5 }}>{cat}</div>
            </div>
            {rows.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EEE4D8", borderRadius: 12, padding: "10px 12px", marginBottom: 7 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12.5, color: "#8A7C6E" }}>{fmt(item.price)}</div>
                </div>
                <button onClick={() => onEdit(item)} style={{ ...stepBtnStyle(false), width: 30, height: 30, marginRight: 6 }}><Pencil size={13} /></button>
                <button onClick={() => onDelete(item.id)} style={{ ...stepBtnStyle(false), width: 30, height: 30, background: "#F8D7DA", color: "#7A2530" }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ history, onOpen }) {
  const totalOmzet = history.reduce((a, s) => a + (s.total || 0), 0);
  const cash = history.filter((s) => s.payment_method === "Cash").reduce((a, s) => a + (s.total || 0), 0);
  const bancontact = history.filter((s) => s.payment_method === "Bancontact").reduce((a, s) => a + (s.total || 0), 0);

  return (
    <div style={{ padding: "8px 18px 100px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <StatCard label="Omzet" value={fmt(totalOmzet)} accent="#6B1E2B" />
        <StatCard label="Cash" value={fmt(cash)} accent="#2E7D6B" />
        <StatCard label="Bancontact" value={fmt(bancontact)} accent="#B5651D" />
      </div>
      {history.length === 0 && <EmptyState icon={<Receipt size={30} color="#B8A99A" />} text="Nog geen afgerekende tafels." />}
      {history.map((s) => (
        <div key={s.id} onClick={() => onOpen(s.id)} style={cardStyle}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#EAF2EE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2E7D6B" }}><Check size={20} /></div>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>Tafel {db.tafelLabel(s)} · {s.naam}</div>
            <div style={{ fontSize: 12.5, color: "#8A7C6E", marginTop: 2 }}>
              {s.paid_at ? new Date(s.paid_at).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""} · {s.payment_method}
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>{fmt(s.total || 0)}</div>
        </div>
      ))}
    </div>
  );
}

function BottomNav({ tab, setTab, isBeheerder, moreOpen, setMoreOpen }) {
  return (
    <>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE4D8", display: "flex", padding: "10px 18px calc(10px + env(safe-area-inset-bottom))" }}>
        <NavItem icon={<Users size={20} />} label="Tafels" active={tab === "tafels"} onClick={() => setTab("tafels")} />
        {isBeheerder && (
          <NavItem icon={<MoreHorizontal size={20} />} label="Meer" active={tab !== "tafels"} onClick={() => setMoreOpen(true)} />
        )}
      </div>
      {moreOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(43,33,29,0.5)", display: "flex", alignItems: "flex-end", zIndex: 30 }} onClick={() => setMoreOpen(false)}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "18px 18px 0 0", padding: "16px 12px calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            {MORE_TABS.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setMoreOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 10px", border: "none", background: tab === t.id ? "#FBF1E4" : "transparent", borderRadius: 10, fontSize: 14.5, fontWeight: 700, color: "#2B211D", cursor: "pointer", textAlign: "left" }}>
                <span style={{ color: "#6B1E2B" }}>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "#6B1E2B" : "#B8A99A", cursor: "pointer", padding: 4 }}>
      {icon}<span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", background: active ? "#6B1E2B" : "#F0E6D8", color: active ? "#fff" : "#8A7C6E", fontWeight: 700, fontSize: 12.5 }}>{label}</button>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #EEE4D8", borderRadius: 12, padding: "10px 10px" }}>
      <div style={{ fontSize: 10.5, color: "#8A7C6E", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: accent, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#B8A99A" }}>
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function OrderScreen({ session, items, menu, categories, cart, query, setQuery, catFilter, setCatFilter, onUpdateCart, onSubmitRound, onBack, onGoBill, onDelete }) {
  const totals = db.aggregateItems(items);
  const cartCount = Object.values(cart).reduce((a, v) => a + v.qty, 0);
  const cartAmount = Object.values(cart).reduce((sum, v) => sum + v.price * v.qty, 0);

  const visibleItems = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      return menu.filter((m) => m.name.toLowerCase().includes(q));
    }
    return menu.filter((m) => m.category === catFilter);
  }, [menu, catFilter, query]);

  function handleAdd(item, delta) {
    onUpdateCart(item, delta);
    if (delta > 0 && query.trim() !== "") setQuery(""); // filter clearen na gebruik van de zoekfunctie
  }

  return (
    <div>
      <div style={{ background: "#6B1E2B", padding: "16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={iconBtnStyle("#8A2E3D")}><ArrowLeft size={18} color="#F4E4C8" /></button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#E8C88A", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Tafel {db.tafelLabel(session)}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{session.naam}</div>
          </div>
          <button onClick={onDelete} style={iconBtnStyle("#8A2E3D")}><Trash2 size={17} color="#F4E4C8" /></button>
        </div>
        <div style={{ position: "relative", marginTop: 12 }}>
          <Search size={15} color="#C79A9F" style={{ position: "absolute", left: 11, top: 10.5 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een item…" style={{ width: "100%", boxSizing: "border-box", background: "#8A2E3D", border: "none", borderRadius: 10, padding: "9px 12px 9px 32px", color: "#fff", fontSize: 13.5, outline: "none" }} />
        </div>
      </div>

      {!query.trim() && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "12px 14px 4px" }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} style={{ whiteSpace: "nowrap", border: "none", borderRadius: 20, padding: "7px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: catFilter === c ? catColor(categories, c) : "#F0E6D8", color: catFilter === c ? "#fff" : "#8A7C6E" }}>{c}</button>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 14px 140px" }}>
        {visibleItems.length === 0 && <EmptyState icon={<UtensilsCrossed size={28} color="#B8A99A" />} text="Geen items gevonden." />}
        {visibleItems.map((item) => {
          const inCart = cart[item.id]?.qty || 0;
          const already = totals[item.id]?.qty || 0;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EEE4D8", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12.5, color: "#8A7C6E", marginTop: 1 }}>{fmt(item.price)}{already > 0 && <span style={{ marginLeft: 6, color: "#B8A99A" }}>· {already}x besteld</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => handleAdd(item, -1)} disabled={inCart === 0} style={stepBtnStyle(inCart === 0)}><Minus size={14} /></button>
                <div style={{ minWidth: 18, textAlign: "center", fontWeight: 800, fontSize: 15 }}>{inCart}</div>
                <button onClick={() => handleAdd(item, 1)} style={stepBtnStyle(false, true)}><Plus size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE4D8", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", boxShadow: "0 -6px 20px rgba(0,0,0,0.06)" }}>
        {cartCount > 0 && (
          <button onClick={onSubmitRound} style={{ width: "100%", background: "#2E7D6B", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 800, fontSize: 14.5, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "center", gap: 8 }}>
            Ronde versturen (print) · {cartCount}x · {fmt(cartAmount)}
          </button>
        )}
        <button onClick={onGoBill} style={{ width: "100%", background: "#6B1E2B", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 800, fontSize: 14.5, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <Receipt size={17} /> Naar rekening · {fmt(db.amountFromItems(items))}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function BillScreen({ session, items, activePrinter, onBack, onAdjust, onFinalize }) {
  const [method, setMethod] = useState("Bancontact");
  const [cashReceived, setCashReceived] = useState("");
  const [printState, setPrintState] = useState(null); // null | "bezig" | "ok" | foutmelding
  const totals = db.aggregateItems(items);
  const lines = Object.values(totals).filter((t) => t.qty !== 0);
  const total = db.amountFromItems(items);
  const received = parseFloat((cashReceived || "0").replace(",", "."));
  const change = method === "Cash" && received > total ? received - total : 0;

  async function handlePrintBill() {
    setPrintState("bezig");
    try {
      await printBillReceipt(activePrinter, { tafelLabel: db.tafelLabel(session), naam: session.naam, lines, total, paymentMethod: method });
      setPrintState("ok");
    } catch (e) {
      console.error(e);
      setPrintState(e.message || String(e));
    }
  }

  return (
    <div>
      <div style={{ background: "#6B1E2B", padding: "16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={iconBtnStyle("#8A2E3D")}><ArrowLeft size={18} color="#F4E4C8" /></button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#E8C88A", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Rekening · Tafel {db.tafelLabel(session)}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{session.naam}</div>
          </div>
          <button onClick={handlePrintBill} disabled={printState === "bezig" || lines.length === 0} style={iconBtnStyle("#8A2E3D")}><Printer size={18} color="#F4E4C8" /></button>
        </div>
      </div>

      {printState && printState !== "bezig" && (
        <div style={{ padding: "8px 14px 0", fontSize: 12.5, color: printState === "ok" ? "#2E7D6B" : "#7A2530" }}>
          {printState === "ok" ? "Rekening naar printer gestuurd." : `Printen mislukt: ${printState}`}
        </div>
      )}

      <div style={{ padding: "14px 14px 200px" }}>
        {lines.length === 0 && <EmptyState icon={<Receipt size={28} color="#B8A99A" />} text="Nog geen items besteld." />}
        {lines.map((line) => (
          <div key={line.id} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F0E6D8" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{line.name}</div>
              <div style={{ fontSize: 12, color: "#8A7C6E" }}>{fmt(line.price)} × {line.qty}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 10 }}>
              <button onClick={() => onAdjust(line.id, line.name, line.price, line.category, -1)} style={stepBtnStyle(false)}><Minus size={12} /></button>
              <button onClick={() => onAdjust(line.id, line.name, line.price, line.category, 1)} style={stepBtnStyle(false, true)}><Plus size={12} /></button>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5, width: 58, textAlign: "right" }}>{fmt(line.price * line.qty)}</div>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0 4px", fontSize: 19, fontWeight: 800 }}><span>Totaal</span><span>{fmt(total)}</span></div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Betaalwijze</div>
          <div style={{ display: "flex", gap: 8 }}>
            <PayButton icon={<Wallet size={16} />} label="Cash" active={method === "Cash"} onClick={() => setMethod("Cash")} />
            <PayButton icon={<CreditCard size={16} />} label="Bancontact" active={method === "Bancontact"} onClick={() => setMethod("Bancontact")} />
          </div>
        </div>

        {method === "Cash" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Ontvangen bedrag</div>
            <input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} inputMode="decimal" placeholder="0,00" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #EEE4D8", borderRadius: 10, padding: "11px 12px", fontSize: 15, fontWeight: 700 }} />
            {received > 0 && <div style={{ marginTop: 8, background: "#EAF2EE", borderRadius: 10, padding: "9px 12px", color: "#2E7D6B", fontWeight: 700, fontSize: 13.5 }}>Terug te geven: {fmt(change)}</div>}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EEE4D8", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", boxShadow: "0 -6px 20px rgba(0,0,0,0.06)" }}>
        <button onClick={() => onFinalize(session, method, received, total)} disabled={lines.length === 0} style={{ width: "100%", background: lines.length === 0 ? "#C7B8A8" : "#2E7D6B", color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 800, fontSize: 15, cursor: lines.length === 0 ? "default" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <Check size={18} /> Afrekenen · {fmt(total)}
        </button>
      </div>
    </div>
  );
}

function PayButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 10, border: active ? "2px solid #6B1E2B" : "1px solid #EEE4D8", background: active ? "#FBF1E4" : "#fff", color: active ? "#6B1E2B" : "#8A7C6E", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{icon} {label}</button>
  );
}

// ---------------------------------------------------------------------------
function DetailScreen({ session, items, onBack }) {
  const lines = Object.values(db.aggregateItems(items)).filter((t) => t.qty !== 0);
  return (
    <div>
      <div style={{ background: "#6B1E2B", padding: "16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={iconBtnStyle("#8A2E3D")}><ArrowLeft size={18} color="#F4E4C8" /></button>
          <div>
            <div style={{ color: "#E8C88A", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Tafel {db.tafelLabel(session)}</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{session.naam}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 14px 40px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <StatCard label="Totaal" value={fmt(session.total || 0)} accent="#6B1E2B" />
          <StatCard label="Betaald met" value={session.payment_method || "-"} accent="#B5651D" />
          <StatCard label="Tijdstip" value={session.paid_at ? new Date(session.paid_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" }) : "-"} accent="#2E7D6B" />
        </div>
        {lines.map((line) => (
          <div key={line.id} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F0E6D8" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{line.name}</div>
              <div style={{ fontSize: 12, color: "#8A7C6E" }}>{fmt(line.price)} × {line.qty}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>{fmt(line.price * line.qty)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function NewTableModal({ existing, onClose, onCreate }) {
  const [tafelNummer, setTafelNummer] = useState("");
  const [tafelLetter, setTafelLetter] = useState(null);
  const [naam, setNaam] = useState("");
  const recentTables = useMemo(() => {
    const seen = new Set();
    return existing.map((s) => db.tafelLabel(s)).filter((l) => (seen.has(l) ? false : seen.add(l))).slice(0, 8);
  }, [existing]);

  const occupied = tafelNummer.trim() !== "" && db.isTableOccupied(existing, tafelNummer, tafelLetter);
  const canCreate = tafelNummer.trim() !== "" && naam.trim() !== "" && !occupied;

  return (
    <ModalShell title="Nieuwe tafel" onClose={onClose}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Tafelnummer</div>
      <input value={tafelNummer} onChange={(e) => setTafelNummer(e.target.value)} inputMode="numeric" placeholder="bv. 12" style={inputStyle} />

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Splitsen? (optioneel)</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[null, "a", "b", "c", "d"].map((l) => (
          <button key={l ?? "geen"} onClick={() => setTafelLetter(l)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: tafelLetter === l ? "2px solid #6B1E2B" : "1px solid #EEE4D8", background: tafelLetter === l ? "#FBF1E4" : "#fff", color: tafelLetter === l ? "#6B1E2B" : "#8A7C6E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {l ? l.toUpperCase() : "Geen"}
          </button>
        ))}
      </div>

      {occupied && (
        <div style={{ background: "#F8D7DA", color: "#7A2530", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>Tafel bezet</div>
      )}

      {recentTables.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {recentTables.map((n) => <span key={n} style={{ border: "1px solid #EEE4D8", background: "#FBF6EE", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "#8A7C6E" }}>Tafel {n} bezet</span>)}
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Naam</div>
      <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Timmermans" style={{ ...inputStyle, marginBottom: 18 }} />

      <button onClick={() => canCreate && onCreate(tafelNummer.trim(), tafelLetter, naam.trim())} disabled={!canCreate} style={primaryBtnStyle(canCreate)}>Tafel starten</button>
    </ModalShell>
  );
}

function MenuItemModal({ item, categories, onClose, onSave }) {
  const isEdit = !!item.id;
  const [name, setName] = useState(item.name || "");
  const [category, setCategory] = useState(item.category || categories[0] || "");
  const [price, setPrice] = useState(item.price !== undefined ? String(item.price).replace(".", ",") : "");
  const parsedPrice = parseFloat((price || "").replace(",", "."));
  const canSave = name.trim() !== "" && category.trim() !== "" && !isNaN(parsedPrice);

  return (
    <ModalShell title={isEdit ? "Item bewerken" : "Nieuw menu-item"} onClose={onClose}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Naam</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Cava" style={inputStyle} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Categorie</div>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="bv. Aperitief" list="categorie-lijst" style={inputStyle} />
      <datalist id="categorie-lijst">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Prijs (€)</div>
      <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="bv. 2,50 (negatief mag, bv. -5)" style={{ ...inputStyle, marginBottom: 18 }} />
      <button onClick={() => canSave && onSave({ name: name.trim(), category: category.trim(), price: parsedPrice })} disabled={!canSave} style={primaryBtnStyle(canSave)}>{isEdit ? "Wijzigingen opslaan" : "Item toevoegen"}</button>
    </ModalShell>
  );
}

function UserModal({ item, onClose, onSave }) {
  const isEdit = !!item.id;
  const [naam, setNaam] = useState(item.naam || "");
  const [categorie, setCategorie] = useState(item.categorie || "Opnemer");
  const [paswoord, setPaswoord] = useState(item.paswoord || "");
  const canSave = naam.trim() !== "" && paswoord.trim() !== "";

  return (
    <ModalShell title={isEdit ? "Gebruiker bewerken" : "Nieuwe gebruiker"} onClose={onClose}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Naam</div>
      <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Karen" style={inputStyle} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Categorie</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["Beheerder", "Opnemer"].map((c) => (
          <button key={c} onClick={() => setCategorie(c)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: categorie === c ? "2px solid #6B1E2B" : "1px solid #EEE4D8", background: categorie === c ? "#FBF1E4" : "#fff", color: categorie === c ? "#6B1E2B" : "#8A7C6E", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{c}</button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Wachtwoord</div>
      <input value={paswoord} onChange={(e) => setPaswoord(e.target.value)} placeholder="bv. Bravo" style={{ ...inputStyle, marginBottom: 18 }} />
      <button onClick={() => canSave && onSave({ naam: naam.trim(), categorie, paswoord: paswoord.trim() })} disabled={!canSave} style={primaryBtnStyle(canSave)}>{isEdit ? "Wijzigingen opslaan" : "Gebruiker toevoegen"}</button>
    </ModalShell>
  );
}

function PrinterModal({ item, beheerders, onClose, onSave }) {
  const isEdit = !!item.id;
  const [naam, setNaam] = useState(item.naam || "");
  const [beheerder, setBeheerder] = useState(item.beheerder || beheerders[0]?.naam || "");
  const [omschrijving, setOmschrijving] = useState(item.omschrijving || "");
  const [qzHost, setQzHost] = useState(item.qz_host || "");
  const canSave = naam.trim() !== "" && beheerder.trim() !== "";

  return (
    <ModalShell title={isEdit ? "Printer bewerken" : "Nieuwe printer"} onClose={onClose}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6 }}>Printernaam (exact zoals in QZ Tray / Windows)</div>
      <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. EPSON TM-T20III" style={inputStyle} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Beheerder</div>
      <input value={beheerder} onChange={(e) => setBeheerder(e.target.value)} list="beheerders-lijst" placeholder="bv. Rudi" style={inputStyle} />
      <datalist id="beheerders-lijst">{beheerders.map((b) => <option key={b.id} value={b.naam} />)}</datalist>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>QZ Tray netwerkadres (IP van de beheerder-PC)</div>
      <input value={qzHost} onChange={(e) => setQzHost(e.target.value)} placeholder="leeg = dit toestel zelf, anders bv. 192.168.1.50" style={inputStyle} />
      <div style={{ fontSize: 11.5, color: "#B8A99A", marginTop: 4 }}>Laat leeg als je dit instelt terwijl je op de PC met de printer zelf zit. Vul het IP-adres van die PC in als andere toestellen (bv. de iPads) hiernaar moeten printen.</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A7C6E", marginBottom: 6, marginTop: 12 }}>Omschrijving (optioneel)</div>
      <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} placeholder="bv. Bij de toog" style={{ ...inputStyle, marginBottom: 18 }} />
      <button onClick={() => canSave && onSave({ naam: naam.trim(), beheerder: beheerder.trim(), omschrijving: omschrijving.trim(), qz_host: qzHost.trim() })} disabled={!canSave} style={primaryBtnStyle(canSave)}>{isEdit ? "Wijzigingen opslaan" : "Printer toevoegen"}</button>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,33,29,0.5)", display: "flex", alignItems: "flex-end", zIndex: 30 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "18px 18px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={iconBtnStyle("#F0E6D8")}><X size={17} color="#6B1E2B" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function iconBtnStyle(bg) {
  return { width: 34, height: 34, borderRadius: 9, background: bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
}
function stepBtnStyle(disabled, primary) {
  return { width: 26, height: 26, borderRadius: 7, border: "none", cursor: disabled ? "default" : "pointer", background: disabled ? "#F0E6D8" : primary ? "#6B1E2B" : "#F0E6D8", color: disabled ? "#C7B8A8" : primary ? "#fff" : "#6B1E2B", display: "flex", alignItems: "center", justifyContent: "center" };
}
function primaryBtnStyle(enabled) {
  return { width: "100%", background: enabled ? "#6B1E2B" : "#C7B8A8", color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 800, fontSize: 15, cursor: enabled ? "pointer" : "default" };
}
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #EEE4D8", borderRadius: 10, padding: "12px", fontSize: 16, fontWeight: 700 };
const cardStyle = { display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EEE4D8", borderRadius: 14, padding: "12px 12px", marginBottom: 9, cursor: "pointer" };
const fabStyle = { position: "fixed", bottom: 88, right: "max(18px, calc(50vw - 240px + 18px))", width: 54, height: 54, borderRadius: 27, background: "#B5651D", border: "none", boxShadow: "0 6px 16px rgba(181,101,29,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 20 };
