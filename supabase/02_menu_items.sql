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
