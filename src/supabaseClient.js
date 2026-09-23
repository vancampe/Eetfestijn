import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Supabase env variabelen ontbreken. Zet VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in .env (lokaal) of in de Netlify site settings."
  );
}

export const supabase = createClient(url || "", anonKey || "");
