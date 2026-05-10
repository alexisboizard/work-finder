import { useEffect, useState } from 'react'
import './index.css'

const AVATAR_PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#0891b2', '#9333ea', '#b45309',
]

function avatarColor(name = '') {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function relativeDate(str) {
  if (!str) return null
  const d = Math.floor((Date.now() - new Date(str)) / 86_400_000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  if (d < 7)  return `Il y a ${d}j`
  if (d < 30) return `Il y a ${Math.floor(d / 7)} sem.`
  return `Il y a ${Math.floor(d / 30)} mois`
}

const SOURCE_STYLE = {
  'France Travail': { bg: '#dbeafe', color: '#1d4ed8' },
  'Adzuna':         { bg: '#fee2e2', color: '#b91c1c' },
  'Indeed':         { bg: '#e0e7ff', color: '#4338ca' },
  'APEC':           { bg: '#d1fae5', color: '#047857' },
  'HelloWork':      { bg: '#fdf4ff', color: '#7c3aed' },
  'Workday':        { bg: '#fff7ed', color: '#c2410c' },
}

function SourceBadge({ source }) {
  const s = SOURCE_STYLE[source] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span className="source-badge" style={{ background: s.bg, color: s.color }}>
      {source}
    </span>
  )
}

function Avatar({ company }) {
  return (
    <div className="avatar" style={{ background: avatarColor(company) }}>
      {initials(company)}
    </div>
  )
}

function SkeletonCard() {
  return <li className="skeleton-card" aria-hidden="true" />
}

export default function App() {
  const [jobs, setJobs]   = useState([])
  const [meta, setMeta]   = useState({ updatedAt: null, demo: false })
  const [q, setQ]         = useState('')
  const [source, setSource] = useState('Toutes')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}jobs.json`)
      .then(r => { if (!r.ok) throw new Error('Impossible de charger les offres'); return r.json() })
      .then(data => {
        if (Array.isArray(data)) {
          setJobs(data)
        } else {
          setJobs(data.jobs ?? [])
          setMeta({ updatedAt: data.updatedAt ?? null, demo: data.demo ?? false })
        }
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const sources  = ['Toutes', ...new Set(jobs.map(j => j.source).filter(Boolean))]
  const filtered = jobs.filter(j => {
    const lq = q.toLowerCase()
    return (
      (!lq || j.title.toLowerCase().includes(lq) || j.company.toLowerCase().includes(lq) || j.location.toLowerCase().includes(lq)) &&
      (source === 'Toutes' || j.source === source)
    )
  })

  const lastUpdated = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="site-header">
        <div className="inner header-inner">
          <div className="logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93A10 10 0 1 0 4.93 19.07"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <span>Work<strong>Finder</strong></span>
          </div>
          <div className="header-right">
            {meta.demo && <span className="demo-pill">Démo</span>}
            {lastUpdated && <span className="updated-txt">MàJ {lastUpdated}</span>}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="inner hero-inner">
          <h1>Trouvez un poste<br />Admin Sys à Montpellier</h1>
          <p>Offres agrégées depuis France Travail et Adzuna · Hérault (34)</p>
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8.5" cy="8.5" r="5.5" /><path d="M17 17l-4-4" />
            </svg>
            <input
              className="search-input"
              placeholder="Linux, VMware, Kubernetes, N2…"
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
            {q && (
              <button className="clear-btn" onClick={() => setQ('')} aria-label="Effacer">✕</button>
            )}
          </div>
        </div>
      </section>

      {/* ── Main ── */}
      <main className="main">
        <div className="inner">

          {/* Toolbar */}
          <div className="toolbar">
            <div className="chips">
              {sources.map(s => (
                <button
                  key={s}
                  className={`chip${source === s ? ' active' : ''}`}
                  onClick={() => setSource(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {!loading && !error && (
              <span className="result-count">
                {filtered.length} offre{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* States */}
          {loading && (
            <ul className="job-list">
              {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
            </ul>
          )}

          {error && (
            <div className="state-box error">
              <span className="state-icon">⚠</span>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="state-box">
              <span className="state-icon">🔍</span>
              <p>Aucune offre ne correspond à votre recherche.</p>
              <button className="reset-btn" onClick={() => { setQ(''); setSource('Toutes') }}>
                Réinitialiser les filtres
              </button>
            </div>
          )}

          {/* Job list */}
          {!loading && !error && filtered.length > 0 && (
            <ul className="job-list">
              {filtered.map((job, i) => (
                <li key={i} className="job-card">
                  <Avatar company={job.company} />
                  <div className="job-body">
                    <h2 className="job-title">{job.title}</h2>
                    <p className="job-meta">
                      <span>{job.company}</span>
                      <span className="dot">·</span>
                      <span>{job.location}</span>
                    </p>
                    <div className="job-tags">
                      {job.source && <SourceBadge source={job.source} />}
                      {job.date   && <span className="job-date">{relativeDate(job.date)}</span>}
                    </div>
                  </div>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="apply-btn">
                    Postuler →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="inner footer-inner">
          <span>© 2025 WorkFinder</span>
          <span>
            Sources :&nbsp;
            <a href="https://francetravail.io" target="_blank" rel="noopener noreferrer">France Travail</a>
            ,&nbsp;
            <a href="https://www.adzuna.fr" target="_blank" rel="noopener noreferrer">Adzuna</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
