-- Eetfestijn POS — Supabase schema
-- Voer dit uit in de Supabase SQL Editor van je project (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- Eén rij per "tafel-sessie" (tafelnummer + naam), zoals Bestelling/Rekening in de Excel
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  tafel_nummer text not null,
  naam text not null,
  status text not null default 'open' check (status in ('open', 'paid')),
  payment_method text check (payment_method in ('Cash', 'Bancontact')),
  cash_received numeric,
  total numeric,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Eén rij per besteld item per "ronde" (ticket), zoals kolommen T1..T10 in Bestelling
-- en de rijen in het tabblad Overzicht
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_label text not null default 'Ronde 1',
  item_id text not null,
  item_name text not null,
  price numeric not null,
  qty integer not null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_session_id_idx on order_items (session_id);
create index if not exists sessions_status_idx on sessions (status);

-- Row Level Security
alter table sessions enable row level security;
alter table order_items enable row level security;

-- Eenvoudige policies: iedereen met de anon-key mag lezen/schrijven.
-- Bedoeld voor intern gebruik tijdens het eetfestijn (gedeeld toestel/link).
-- Wil je dit afschermen, koppel er dan Supabase Auth aan en vervang "true"
-- hieronder door bv. "auth.role() = 'authenticated'".
drop policy if exists "allow all sessions" on sessions;
create policy "allow all sessions" on sessions for all using (true) with check (true);

drop policy if exists "allow all order_items" on order_items;
create policy "allow all order_items" on order_items for all using (true) with check (true);

-- Realtime inschakelen zodat meerdere toestellen elkaars bestellingen live zien
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table order_items;
-- Eetfestijn POS — migratie 2: menu beheerbaar maken vanuit de app
-- Voer dit uit in Supabase SQL Editor (Project > SQL Editor > New query).
-- Dit is een AANVULLING op schema.sql dat je al eerder hebt uitgevoerd —
-- je hoeft schema.sql niet opnieuw te draaien.

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table menu_items enable row level security;

drop policy if exists "allow all menu_items" on menu_items;
create policy "allow all menu_items" on menu_items for all using (true) with check (true);

alter publication supabase_realtime add table menu_items;

-- Startmenu (op basis van je huidige prijslijst).
-- Twee dingen heb ik gecorrigeerd bij het overnemen:
--  - "Kaarten" stond dubbel in de lijst (eenmaal als Lindemans -5, eenmaal als
--    Andere zonder prijs) -> hier één keer opgenomen: Andere, -5.
--  - "Pêcheresse"/"Sportzot 0%" leken van categorie gewisseld (Pêcheresse is
--    een Lindemans-fruitbier, Sportzot 0% hoort bij "Sportzot") -> hier
--    rechtgezet. Klopt dit niet, pas het gewoon aan via het Beheer-scherm.
insert into menu_items (name, category, price, sort_order) values
  ('Aperitief Leeuwerik', 'Aperitief', 6.0, 1),
  ('Cava', 'Aperitief', 5.0, 2),
  ('Mojito', 'Aperitief', 6.0, 3),
  ('Mojito alkoholvrij', 'Aperitief', 5.0, 4),
  ('Martini rood / wit', 'Aperitief', 4.0, 5),
  ('Porto rood / wit', 'Aperitief', 4.0, 6),
  ('Aperitiefschoteltje', 'Aperitief', 6.0, 7),
  ('Kaas- en vleesbuffet', 'Buffet', 20.0, 8),
  ('Kinderbuffet (-12 jaar)', 'Buffet', 12.0, 9),
  ('Koffie / Deca', 'Dessert', 2.5, 10),
  ('Thee', 'Dessert', 2.5, 11),
  ('Hasseltse koffie', 'Dessert', 4.0, 12),
  ('Kinderijsje', 'Dessert', 4.0, 13),
  ('Dame blanche', 'Dessert', 6.0, 14),
  ('Bresiliennetaart', 'Dessert', 5.0, 15),
  ('Kriekentaart', 'Dessert', 5.0, 16),
  ('Limoncello', 'Dessert', 5.0, 17),
  ('Water plat', 'Frisdrank', 2.5, 18),
  ('Water bruisend', 'Frisdrank', 2.5, 19),
  ('Fanta / Icetea', 'Frisdrank', 2.5, 20),
  ('Cola / Cola Zero', 'Frisdrank', 2.5, 21),
  ('Jupiler', 'Bier', 2.5, 22),
  ('Leffe Blond / donker', 'Bier', 4.5, 23),
  ('Bersalis', 'Bier', 4.5, 24),
  ('Chimay blauw', 'Bier', 4.5, 25),
  ('Kriek', 'Bier', 3.0, 26),
  ('Glas wijn wit / rood', 'Wijn', 4.0, 27),
  ('Karaf wijn: rood / wit', 'Wijn', 7.0, 28),
  ('Fles Chardonnay', 'Wijn', 14.0, 29),
  ('Fles Côtes du Rhône', 'Wijn', 13.0, 30),
  ('Fles Bordeaux', 'Wijn', 16.0, 31),
  ('Rondje personeel', 'Andere', 20.0, 32),
  ('Kaarten (aftrek)', 'Andere', -5.0, 33),
  ('Mojito kriek', 'Lindemans', 6.5, 34),
  ('Apple', 'Lindemans', 3.5, 35),
  ('Framboise', 'Lindemans', 3.5, 36),
  ('Cassis', 'Lindemans', 3.5, 37),
  ('Pêcheresse', 'Lindemans', 3.5, 38),
  ('Sportzot 0%', 'Sportzot', 3.5, 39),
  ('Lindemans 0%', 'Lindemans', 3.5, 40);
-- Eetfestijn POS — migratie 3
-- Voer dit uit in Supabase SQL Editor. Dit is een AANVULLING op schema.sql
-- en 02_menu_items.sql die je al eerder draaide.

-- 1) Gebruikers + rollen ("Beheer"-tabel)
create table if not exists beheer (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  categorie text not null check (categorie in ('Beheerder', 'Opnemer')),
  paswoord text not null,
  created_at timestamptz not null default now()
);

alter table beheer enable row level security;
drop policy if exists "allow all beheer" on beheer;
create policy "allow all beheer" on beheer for all using (true) with check (true);
alter publication supabase_realtime add table beheer;

insert into beheer (naam, categorie, paswoord) values
  ('Rudi', 'Beheerder', 'Bravo'),
  ('Christophe', 'Opnemer', 'Alpha'),
  ('Karen', 'Opnemer', 'Papa'),
  ('RVC', 'Opnemer', 'Tango');

-- LET OP: wachtwoorden staan hier in leesbare tekst, passend bij de rest van
-- dit project (open policies, bedoeld voor intern gebruik tijdens het
-- evenement). Gebruik geen gevoelige/herbruikte wachtwoorden.

-- 2) Printers (informatief — zie toelichting in de app/README)
create table if not exists printers (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  beheerder text not null,
  omschrijving text,
  created_at timestamptz not null default now()
);

alter table printers enable row level security;
drop policy if exists "allow all printers" on printers;
create policy "allow all printers" on printers for all using (true) with check (true);
alter publication supabase_realtime add table printers;

-- 3) Tafels splitsen in a/b/c/d + wie de tafel bedient
alter table sessions add column if not exists tafel_letter text;
alter table sessions add column if not exists opnemer text;

-- 4) order_items: categorie en opnemer mee opslaan (voor het tabblad Overzicht
--    en het printticket), net zoals naam/prijs al gebeurde.
alter table order_items add column if not exists category text;
alter table order_items add column if not exists opnemer text;
-- Eetfestijn POS — migratie 4: printers koppelen aan QZ Tray
-- Voer dit uit in Supabase SQL Editor. Aanvulling op de vorige migraties.

alter table printers add column if not exists qz_host text;
alter table printers add column if not exists active boolean not null default false;

-- Zorg dat er nooit meer dan één printer "actief" (geselecteerd) staat.
create unique index if not exists printers_only_one_active
  on printers ((active))
  where active = true;
