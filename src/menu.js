// Het menu zelf komt nu uit de Supabase-tabel "menu_items" (zie db.js:fetchMenu).
// Dit bestand bevat enkel weergave-helpers: geldnotatie, categorie-volgorde en -kleur.

export const fmt = (n) => "€" + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");

// Bekende categorieën komen in deze volgorde te staan; nieuwe/onbekende
// categorieën (die je zelf aanmaakt via Beheer) worden erachter geplakt,
// alfabetisch gesorteerd.
const PREFERRED_CATEGORY_ORDER = [
  "Aperitief", "Buffet", "Dessert", "Frisdrank", "Bier", "Wijn", "Lindemans", "Sportzot", "Andere",
];

const PALETTE = [
  "#B8862F", "#6B1E2B", "#8C5A8C", "#2E7D6B", "#B5651D",
  "#4A6FA5", "#A13D5C", "#3F6B4A", "#5C5347", "#8A6D3B", "#7A3E65", "#2F6B72",
];

export function orderedCategories(menu) {
  const present = Array.from(new Set(menu.map((m) => m.category)));
  const known = PREFERRED_CATEGORY_ORDER.filter((c) => present.includes(c));
  const unknown = present.filter((c) => !PREFERRED_CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

export function catColor(categories, cat) {
  const idx = categories.indexOf(cat);
  if (idx === -1) return "#5C5347";
  return PALETTE[idx % PALETTE.length];
}
