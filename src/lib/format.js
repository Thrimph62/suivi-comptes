import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export const fmt = n => eur.format(n)
export const fmtDiff = n => (n >= 0 ? '+' : '') + fmt(n)
export const fdate = (d, p = 'd MMM yyyy') => format(parseISO(d), p, { locale: fr })
export const catLabel = c => (c ? c.parent + (c.sous_categorie ? ` — ${c.sous_categorie}` : '') : '—')
export const sum = a => a.reduce((s, t) => s + Number(t.montant), 0)
export const TX = 'suivi_comptes_transactions'
