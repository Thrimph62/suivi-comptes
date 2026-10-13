import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Supabase plafonne chaque requête à 1000 lignes : on pagine. `q` = () => requête ordonnée (avec un tri stable, ex. .order('id')).
export async function fetchAll(q) {
  const rows = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q().range(i, i + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
