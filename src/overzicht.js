import * as XLSX from "xlsx";
import { tafelLabel } from "./db";

const DAGEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function dagdeel(date) {
  const h = date.getHours();
  if (h < 12) return "Voormiddag";
  if (h < 18) return "Namiddag";
  return "Avond";
}

// Bouwt één rij per bestelde regel (order_items), voor afgerekende tafels.
export function buildOverzichtRows(paidSessions, itemsBySession) {
  const rows = [];
  for (const session of paidSessions) {
    const items = itemsBySession[session.id] || [];
    for (const row of items) {
      const d = new Date(row.created_at);
      const bedrag = row.price * row.qty;
      rows.push({
        Datum: d.toLocaleDateString("nl-BE"),
        Tafel: tafelLabel(session),
        Naam: session.naam,
        Item: row.item_name,
        Aantal: row.qty,
        Bedrag: Math.round(bedrag * 100) / 100,
        Betalingswijze: session.payment_method || "",
        In_Kas: session.payment_method === "Cash" ? Math.round(bedrag * 100) / 100 : 0,
        Dag: DAGEN[d.getDay()],
        Categorie: row.category || "",
        "AM/PM": dagdeel(d),
        Opnemer: row.opnemer || session.opnemer || "",
      });
    }
  }
  // recentste eerst
  rows.sort((a, b) => (a.Datum < b.Datum ? 1 : -1));
  return rows;
}

export function exportOverzichtXlsx(rows, filename = "overzicht-eetfestijn.xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Overzicht");
  XLSX.writeFile(wb, filename);
}
