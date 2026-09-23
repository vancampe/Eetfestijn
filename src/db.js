import { supabase } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Login / gebruikers ("beheer"-tabel)
// ---------------------------------------------------------------------------
export async function fetchUsers() {
  const { data, error } = await supabase.from("beheer").select("*").order("naam", { ascending: true });
  if (error) throw error;
  return data;
}

export async function login(naam, paswoord) {
  const { data, error } = await supabase
    .from("beheer")
    .select("*")
    .eq("naam", naam)
    .eq("paswoord", paswoord)
    .maybeSingle();
  if (error) throw error;
  return data; // null als geen match
}

export async function createUser({ naam, categorie, paswoord }) {
  const { data, error } = await supabase.from("beheer").insert({ naam, categorie, paswoord }).select().single();
  if (error) throw error;
  return data;
}

export async function updateUser(id, { naam, categorie, paswoord }) {
  const { data, error } = await supabase.from("beheer").update({ naam, categorie, paswoord }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUser(id) {
  const { error } = await supabase.from("beheer").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Printers (informatief, zie README/app voor de beperking)
// ---------------------------------------------------------------------------
export async function fetchPrinters() {
  const { data, error } = await supabase.from("printers").select("*").order("naam", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPrinter({ naam, beheerder, omschrijving, qz_host }) {
  const { data, error } = await supabase.from("printers").insert({ naam, beheerder, omschrijving, qz_host }).select().single();
  if (error) throw error;
  return data;
}

export async function updatePrinter(id, { naam, beheerder, omschrijving, qz_host }) {
  const { data, error } = await supabase.from("printers").update({ naam, beheerder, omschrijving, qz_host }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePrinter(id) {
  const { error } = await supabase.from("printers").delete().eq("id", id);
  if (error) throw error;
}

// Zorgt ervoor dat maximaal één printer tegelijk "actief" (geselecteerd) is.
export async function setActivePrinter(id) {
  const { error: e1 } = await supabase.from("printers").update({ active: false }).eq("active", true);
  if (e1) throw e1;
  const { data, error: e2 } = await supabase.from("printers").update({ active: true }).eq("id", id).select().single();
  if (e2) throw e2;
  return data;
}

// Is er al een open tafel met dit tafelnummer + letter?
export function isTableOccupied(sessions, tafelNummer, tafelLetter) {
  const norm = (v) => (v || "").toString().trim().toLowerCase();
  return sessions.some((s) => norm(s.tafel_nummer) === norm(tafelNummer) && norm(s.tafel_letter) === norm(tafelLetter));
}

// ---------------------------------------------------------------------------
// Sessies (tafels)
// ---------------------------------------------------------------------------
export async function fetchOpenSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchHistorySessions(limit = 500) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function createSession(tafelNummer, tafelLetter, naam, opnemer) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ tafel_nummer: tafelNummer, tafel_letter: tafelLetter || null, naam, status: "open", opnemer })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function finalizeSession(sessionId, paymentMethod, cashReceived, total) {
  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "paid",
      payment_method: paymentMethod,
      cash_received: paymentMethod === "Cash" ? cashReceived : null,
      total,
      paid_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function tafelLabel(session) {
  return `${session.tafel_nummer}${session.tafel_letter ? session.tafel_letter.toUpperCase() : ""}`;
}

// ---------------------------------------------------------------------------
// Bestelde items (order_items) — naam, prijs en categorie worden bij het
// bestellen zelf mee opgeslagen (denormalized), zodat latere wijzigingen in
// het menu bestaande rekeningen/rapportages niet met terugwerkende kracht
// veranderen.
// ---------------------------------------------------------------------------
export async function fetchOrderItemsForSessions(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

// cart shape: { [itemId]: { name, price, qty, category } }
export async function insertRound(sessionId, cart, roundLabel, opnemer) {
  const rows = Object.entries(cart).map(([itemId, v]) => ({
    session_id: sessionId,
    round_label: roundLabel,
    item_id: itemId,
    item_name: v.name,
    category: v.category,
    price: v.price,
    qty: v.qty,
    opnemer,
  }));
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from("order_items").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function insertCorrection(sessionId, itemId, name, price, category, delta, opnemer) {
  const { data, error } = await supabase
    .from("order_items")
    .insert({
      session_id: sessionId,
      round_label: "Correcties",
      item_id: itemId,
      item_name: name,
      category,
      price,
      qty: delta,
      opnemer,
    })
    .select();
  if (error) throw error;
  return data;
}

// Aggregeert alle rijen van een sessie tot { [itemId]: { id, name, price, qty, category } }
export function aggregateItems(orderItems) {
  const totals = {};
  for (const row of orderItems) {
    if (!totals[row.item_id]) {
      totals[row.item_id] = { id: row.item_id, name: row.item_name, price: row.price, category: row.category, qty: 0 };
    }
    totals[row.item_id].qty += row.qty;
    totals[row.item_id].name = row.item_name;
    totals[row.item_id].price = row.price;
    totals[row.item_id].category = row.category;
  }
  return totals;
}

export function amountFromItems(orderItems) {
  let sum = 0;
  for (const row of orderItems) sum += row.price * row.qty;
  return sum;
}

// ---------------------------------------------------------------------------
// Menu (beheerbaar vanuit de app)
// ---------------------------------------------------------------------------
export async function fetchMenu() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMenuItem({ name, category, price }) {
  const { data, error } = await supabase
    .from("menu_items")
    .insert({ name, category, price, sort_order: 999 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMenuItem(id, { name, category, price }) {
  const { data, error } = await supabase
    .from("menu_items")
    .update({ name, category, price })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMenuItem(id) {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel("eetfestijn-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "beheer" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "printers" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
