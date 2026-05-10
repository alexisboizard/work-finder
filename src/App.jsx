import { useEffect, useState } from 'react'
import './index.css'

function relativeDate(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  if (diff < 7) return `Il y a ${diff} jours`
  if (diff < 30) return `Il y a ${Math.floor(diff / 7)} sem.`
  return `Il y a ${Math.floor(diff / 30)} mois`
}

export default function App() {
  const [jobs, setJobs] = useState([])
  const [meta, setMeta] = useState({ updatedAt: null, demo: false })
  const [q, setQ] = useState('')
  const [source, setSource] = useState('Toutes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}jobs.json`)
      .then(r => {
        if (!r.ok) throw new Error('Impossible de charger les offres')
        return r.json()
      })
      .then(data => {
        // Compatibilité : ancien format tableau ou nouveau format objet
        if (Array.isArray(data)) {
          setJobs(data)
        } else {
          setJobs(data.jobs ?? [])
          setMeta({ updatedAt: data.updatedAt ?? null, demo: data.demo ?? false })
        }
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const sources = ['Toutes', ...new Set(jobs.map(j => j.source).filter(Boolean))]

  const filtered = jobs.filter(j => {
    const query = q.toLowerCase()
    const matchQuery = !query || (
      j.title.toLowerCase().includes(query) ||
      j.company.toLowerCase().includes(query) ||
      j.location.toLowerCase().includes(query)
    )
    const matchSource = source === 'Toutes' || j.source === source
    return matchQuery && matchSource
  })

  const lastUpdated = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="container">
      <header className="header">
        <h1>Work Finder</h1>
        <p className="subtitle">Offres Admin Sys · Montpellier & Hérault</p>
        {lastUpdated && (
          <p className="last-updated">
            {meta.demo && <span className="demo-badge">Démo</span>}
            Mis à jour le {lastUpdated}
          </p>
        )}
      </header>

      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Linux, VMware, Kubernetes, N2, entreprise..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {sources.length > 2 && (
        <div className="source-filters">
          {sources.map(s => (
            <button
              key={s}
              className={`source-chip${source === s ? ' active' : ''}`}
              onClick={() => setSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="status">Chargement des offres…</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <>
          <p className="count">
            {filtered.length} offre{filtered.length !== 1 ? 's' : ''} trouvée{filtered.length !== 1 ? 's' : ''}
          </p>

          {filtered.length === 0 ? (
            <p className="status">Aucune offre ne correspond à votre recherche.</p>
          ) : (
            <ul className="job-list">
              {filtered.map((job, i) => (
                <li key={i} className="job-card">
                  <div className="job-info">
                    <h2 className="job-title">{job.title}</h2>
                    <p className="job-meta">{job.company} · {job.location}</p>
                    <div className="job-tags">
                      {job.source && <span className="job-source">{job.source}</span>}
                      {job.date && <span className="job-date">{relativeDate(job.date)}</span>}
                    </div>
                  </div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="job-link"
                  >
                    Postuler →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
