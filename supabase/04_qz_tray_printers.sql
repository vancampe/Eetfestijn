-- Eetfestijn POS — migratie 4: printers koppelen aan QZ Tray
-- Voer dit uit in Supabase SQL Editor. Aanvulling op de vorige migraties.

alter table printers add column if not exists qz_host text;
alter table printers add column if not exists active boolean not null default false;

-- Zorg dat er nooit meer dan één printer "actief" (geselecteerd) staat.
create unique index if not exists printers_only_one_active
  on printers ((active))
  where active = true;
