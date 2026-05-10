import { useEffect, useState } from 'react'
import './index.css'

export default function App() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}jobs.json`)
      .then(r => {
        if (!r.ok) throw new Error('Impossible de charger les offres')
        return r.json()
      })
      .then(data => {
        setJobs(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filtered = jobs.filter(j => {
    const query = q.toLowerCase()
    return (
      j.title.toLowerCase().includes(query) ||
      j.company.toLowerCase().includes(query) ||
      j.location.toLowerCase().includes(query)
    )
  })

  return (
    <div className="container">
      <header className="header">
        <h1>Work Finder</h1>
        <p className="subtitle">Offres Admin Sys · Montpellier</p>
      </header>

      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Rechercher : Linux, VMware, N2, entreprise..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

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
                    {job.source && <span className="job-source">{job.source}</span>}
                  </div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="job-link"
                  >
                    Voir l'offre →
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
