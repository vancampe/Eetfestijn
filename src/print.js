import qz from "qz-tray";
import { CLUB_NAME, THANK_YOU_LINE, LOGO_DATA_URI } from "./branding";

// A5-formaat voor beide tickets (kassabon en keukenticket)
const A5 = { width: 148, height: 210, units: "mm" };

let connectedHost = undefined;

async function ensureConnected(host) {
  const targetHost = host || undefined; // undefined = localhost (default QZ-gedrag)
  if (qz.websocket.isActive() && connectedHost === targetHost) return;
  if (qz.websocket.isActive()) {
    try { await qz.websocket.disconnect(); } catch { /* negeren */ }
  }
  await qz.websocket.connect(targetHost ? { host: targetHost } : undefined);
  connectedHost = targetHost;
}

// activePrinter: rij uit de "printers"-tabel met minstens { naam, qz_host }
async function sendToPrinter(activePrinter, html) {
  if (!activePrinter) {
    throw new Error("Geen printer geselecteerd. Ga naar de tab Printers en kies een actieve printer.");
  }
  await ensureConnected(activePrinter.qz_host);
  const config = qz.configs.create(activePrinter.naam, {
    size: A5,
    units: "mm",
    margins: 0,
    orientation: "portrait",
    scaleContent: true,
    rasterize: true,
  });
  await qz.print(config, [{ type: "pixel", format: "html", flavor: "plain", data: html }]);
}

export async function disconnectPrinter() {
  if (qz.websocket.isActive()) {
    try { await qz.websocket.disconnect(); } catch { /* negeren */ }
  }
  connectedHost = undefined;
}

export async function findLocalPrinters(host) {
  await ensureConnected(host);
  return qz.printers.find();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Vaste, expliciete afmetingen (A5 = 148 x 210mm) zodat de inhoud niet
// wordt uitgerekt of afgesneden ongeacht welk papierformaat de printer
// zelf als standaard gebruikt.
const BASE_STYLE = `
  @page { size: 148mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: 148mm; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; padding: 8mm 7mm; font-size: 11px; }
  h1 { font-size: 13px; margin: 0 22mm 2px 0; line-height: 1.25; }
  h2 { font-size: 12px; margin: 0 0 8px; font-weight: 700; }
  .meta { font-size: 10.5px; margin-bottom: 3px; }
  .logo { float: right; width: 20mm; margin-top: -2mm; }
  table { border-collapse: collapse; width: 100%; margin-top: 6px; font-size: 11px; table-layout: fixed; }
  th { text-align: left; border-bottom: 2px solid #111; padding: 3px 2px; }
  td { padding: 3px 2px; border-bottom: 1px solid #ccc; word-wrap: break-word; }
  .num { text-align: right; white-space: nowrap; width: 16mm; }
  .total-row td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 12.5px; padding-top: 6px; }
  .footer { margin-top: 14px; font-size: 10.5px; }
`;

// ---------------------------------------------------------------------------
// Keukenticket bij "Ronde versturen" — enkel de items van deze ronde.
// ---------------------------------------------------------------------------
export async function printRoundTicket(activePrinter, { tafelLabel, naam, opnemer, items }) {
  const now = new Date();
  const datum = now.toLocaleDateString("nl-BE");
  const tijd = now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

  const rows = items
    .map(([, v]) => `<tr><td>${escapeHtml(v.name)}</td><td class="num">${v.qty}</td></tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
    <img class="logo" src="${LOGO_DATA_URI}" />
    <h1>${escapeHtml(CLUB_NAME)}</h1>
    <h2>Tafel ${escapeHtml(tafelLabel)} — ${escapeHtml(naam)}</h2>
    <div class="meta"><b>Opnemer:</b> ${escapeHtml(opnemer || "")}</div>
    <div class="meta"><b>Datum:</b> ${datum} &nbsp; <b>Tijd:</b> ${tijd}</div>
    <table>
      <thead><tr><th>Item</th><th class="num">Aantal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  await sendToPrinter(activePrinter, html);
}

// ---------------------------------------------------------------------------
// Kassabon bij "Print" op de Rekening — volledige, afgerekende rekening.
// ---------------------------------------------------------------------------
export async function printBillReceipt(activePrinter, { tafelLabel, naam, lines, total, paymentMethod }) {
  const now = new Date();
  const datumStr = now.toLocaleDateString("nl-BE");

  const rows = lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}</td><td class="num">${l.qty}</td><td class="num">€ ${(l.price * l.qty).toFixed(1)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
    <img class="logo" src="${LOGO_DATA_URI}" />
    <h1>${escapeHtml(CLUB_NAME)}</h1>
    <h2>Tafel ${escapeHtml(tafelLabel)}</h2>
    <div class="meta">${datumStr}</div>
    <table>
      <thead><tr><th>Item</th><th class="num">Aantal</th><th class="num">Totaal (Euro)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row"><td></td><td></td><td class="num">€ ${total.toFixed(1)}</td></tr></tfoot>
    </table>
    <div class="footer">
      Betaald met ${escapeHtml(paymentMethod)}<br/><br/>
      ${escapeHtml(THANK_YOU_LINE)}
    </div>
  </body></html>`;

  await sendToPrinter(activePrinter, html);
}
