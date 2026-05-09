
import { useEffect, useState } from 'react'

export default function App() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState("")

  useEffect(() => {
    fetch('/jobs.json')
      .then(r => r.json())
      .then(setJobs)
  }, [])

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Work Finder - Admin Sys Montpellier</h1>

      <input
        placeholder="Linux, VMware, N2..."
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ padding: 10, width: '100%', margin: '10px 0' }}
      />

      {filtered.map((job, i) => (
        <div key={i} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 10 }}>
          <h3>{job.title}</h3>
          <p>{job.company} - {job.location}</p>
          <a href={job.url} target="_blank">Voir</a>
        </div>
      ))}
    </div>
  )
}
