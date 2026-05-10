import fs from 'fs'

const DEPT = '34' // Hérault
const CITY = 'Montpellier'

// Dates relatives pour les données de démo
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

const DEMO_JOBS = [
  { title: 'Administrateur Système Linux Senior', company: 'DataCenter Sud', location: 'Montpellier', url: 'https://candidat.francetravail.fr/offres/detail/DEMO001', source: 'France Travail', date: daysAgo(1) },
  { title: 'Technicien Infrastructure N2', company: 'ITServices34', location: 'Montpellier', url: 'https://candidat.francetravail.fr/offres/detail/DEMO002', source: 'France Travail', date: daysAgo(2) },
  { title: 'Ingénieur Systèmes VMware / vSphere', company: 'Cloud Hérault', location: 'Montpellier', url: 'https://www.adzuna.fr/details/demo003', source: 'Adzuna', date: daysAgo(3) },
  { title: 'Administrateur Systèmes & Réseaux', company: 'Région Occitanie', location: 'Montpellier', url: 'https://candidat.francetravail.fr/offres/detail/DEMO004', source: 'France Travail', date: daysAgo(4) },
  { title: 'DevOps / Admin Sys – Kubernetes & Ansible', company: 'StartupTech', location: 'Montpellier (remote partiel)', url: 'https://www.adzuna.fr/details/demo005', source: 'Adzuna', date: daysAgo(5) },
  { title: 'Responsable Infrastructure IT', company: 'CHU Montpellier', location: 'Montpellier', url: 'https://candidat.francetravail.fr/offres/detail/DEMO006', source: 'France Travail', date: daysAgo(7) },
  { title: 'Administrateur Active Directory & M365', company: 'Banque Régionale', location: 'Montpellier', url: 'https://www.adzuna.fr/details/demo007', source: 'Adzuna', date: daysAgo(8) },
  { title: 'Admin Sys N3 – Linux / Bash / Puppet', company: 'ESN Montpellier', location: 'Montpellier', url: 'https://www.adzuna.fr/details/demo008', source: 'Adzuna', date: daysAgo(10) },
]

// --- France Travail API ---
async function fetchFranceTravail() {
  const tokenRes = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.FT_CLIENT_ID,
        client_secret: process.env.FT_CLIENT_SECRET,
        scope: 'api_offresdemploiv2 o2dsoffre',
      }),
    }
  )
  if (!tokenRes.ok) throw new Error(`Auth France Travail échouée (${tokenRes.status})`)
  const { access_token } = await tokenRes.json()

  const keywords = ['administrateur système', 'admin sys linux', 'ingénieur système linux']
  const seen = new Set()
  const jobs = []

  for (const kw of keywords) {
    const url = new URL('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search')
    url.searchParams.set('motsCles', kw)
    url.searchParams.set('departement', DEPT)
    url.searchParams.set('range', '0-49')

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`  FT "${kw}" → ${res.status}`)
      continue
    }

    const data = await res.json()
    for (const o of data.resultats ?? []) {
      if (seen.has(o.id)) continue
      seen.add(o.id)
      jobs.push({
        title: o.intitule,
        company: o.entreprise?.nom || 'Non précisé',
        location: o.lieuTravail?.libelle || CITY,
        url: o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/detail/${o.id}`,
        source: 'France Travail',
        date: o.dateCreation?.slice(0, 10) ?? null,
      })
    }
  }
  return jobs
}

// --- Adzuna API ---
async function fetchAdzuna() {
  const url = new URL('https://api.adzuna.com/v1/api/jobs/fr/search/1')
  url.searchParams.set('app_id', process.env.ADZUNA_APP_ID)
  url.searchParams.set('app_key', process.env.ADZUNA_APP_KEY)
  url.searchParams.set('what', 'administrateur système linux')
  url.searchParams.set('where', CITY)
  url.searchParams.set('distance', '30')
  url.searchParams.set('results_per_page', '50')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Adzuna ${res.status}`)
  const data = await res.json()

  return (data.results ?? []).map(j => ({
    title: j.title,
    company: j.company?.display_name || 'Non précisé',
    location: j.location?.display_name || CITY,
    url: j.redirect_url,
    source: 'Adzuna',
    date: j.created?.slice(0, 10) ?? null,
  }))
}

// --- Déduplication par URL ---
function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => {
    const key = j.url || `${j.title}|${j.company}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- Main ---
async function main() {
  const all = []
  let demo = false

  if (process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET) {
    try {
      const jobs = await fetchFranceTravail()
      all.push(...jobs)
      console.log(`✓ France Travail : ${jobs.length} offres`)
    } catch (e) {
      console.error(`✗ France Travail : ${e.message}`)
    }
  } else {
    console.log('  France Travail : pas de clés (FT_CLIENT_ID / FT_CLIENT_SECRET)')
  }

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    try {
      const jobs = await fetchAdzuna()
      all.push(...jobs)
      console.log(`✓ Adzuna : ${jobs.length} offres`)
    } catch (e) {
      console.error(`✗ Adzuna : ${e.message}`)
    }
  } else {
    console.log('  Adzuna : pas de clés (ADZUNA_APP_ID / ADZUNA_APP_KEY)')
  }

  if (all.length === 0) {
    console.log('⚠ Aucune source active — utilisation des données de démo')
    all.push(...DEMO_JOBS)
    demo = true
  }

  const unique = dedupe(all)
  unique.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  const output = {
    updatedAt: new Date().toISOString(),
    demo,
    count: unique.length,
    jobs: unique,
  }

  fs.writeFileSync('public/jobs.json', JSON.stringify(output, null, 2))
  console.log(`✓ jobs.json : ${unique.length} offres (${demo ? 'démo' : 'live'})`)
}

main()
