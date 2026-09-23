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
