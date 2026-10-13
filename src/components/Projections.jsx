import { fmt, fmtDiff } from '../lib/format'

// Lignes "1 mois / 3 mois / 1 an" à partir d'un objet de soldes {aujourdhui, m1, m3, m12}
export default function Projections({ s, dark }) {
  return [['1 mois', 'm1'], ['3 mois', 'm3'], ['1 an', 'm12']].map(([label, k]) => {
    const d = s[k] - s.aujourdhui
    const tone = d >= 0 ? (dark ? 'text-emerald-300' : 'text-emerald-500') : (dark ? 'text-red-300' : 'text-red-400')
    return (
      <div key={k} className="flex items-center justify-between gap-3">
        <span className={`text-xs ${dark ? 'text-emerald-300' : 'text-gray-400'}`}>{label}</span>
        <span className={`font-semibold ${dark ? 'text-white text-sm' : 'text-xs text-gray-700'}`}>{fmt(s[k])}</span>
        <span className={`text-xs font-medium ${tone}`}>{fmtDiff(d)}</span>
      </div>
    )
  })
}
