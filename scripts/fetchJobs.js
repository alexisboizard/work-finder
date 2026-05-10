import fs from 'fs'

const DEPT = '34'
const CITY = 'Montpellier'
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

const DEMO_JOBS = [
  { title: 'Administrateur Système Linux Senior',  company: 'DataCenter Sud',  location: CITY,           url: 'https://candidat.francetravail.fr/offres/detail/DEMO001', source: 'France Travail', date: daysAgo(1)  },
  { title: 'Technicien Infrastructure N2',         company: 'ITServices34',    location: CITY,           url: 'https://candidat.francetravail.fr/offres/detail/DEMO002', source: 'France Travail', date: daysAgo(2)  },
  { title: 'Ingénieur Infrastructure VMware',      company: 'Cloud Hérault',   location: CITY,           url: 'https://candidat.francetravail.fr/offres/detail/DEMO003', source: 'France Travail', date: daysAgo(3)  },
  { title: 'Admin Sys N2/N3 – Active Directory',   company: 'Capgemini',       location: CITY,           url: 'https://www.adzuna.fr/details/demo004',                  source: 'Adzuna',         date: daysAgo(4)  },
  { title: 'Administrateur Linux / Ansible',       company: 'SNCF',            location: CITY,           url: 'https://www.adzuna.fr/details/demo005',                  source: 'Adzuna',         date: daysAgo(5)  },
  { title: 'DevOps / Admin Sys – Kubernetes',      company: 'Sopra Steria',    location: CITY,           url: 'https://www.adzuna.fr/details/demo006',                  source: 'Adzuna',         date: daysAgo(6)  },
  { title: 'Responsable Infrastructure IT',        company: 'CHU Montpellier', location: CITY,           url: 'https://candidat.francetravail.fr/offres/detail/DEMO007', source: 'France Travail', date: daysAgo(8)  },
  { title: 'Ingénieur Systèmes / Admin Sys',       company: 'Thales',          location: CITY,           url: 'https://www.adzuna.fr/details/demo008',                  source: 'Adzuna',         date: daysAgo(10) },
  { title: 'Administrateur Systèmes & Réseaux',    company: 'Région Occitanie',location: CITY,           url: 'https://candidat.francetravail.fr/offres/detail/DEMO009', source: 'France Travail', date: daysAgo(12) },
  { title: 'Admin Sys N3 – Linux / Bash / Puppet', company: 'ESN Montpellier', location: CITY,           url: 'https://www.adzuna.fr/details/demo010',                  source: 'Adzuna',         date: daysAgo(14) },
]

function toDate(str) {
  if (!str) return null
  try { return new Date(str).toISOString().slice(0, 10) } catch { return null }
}

// ─── France Travail (OAuth2 + REST) ──────────────────────────────────────────
// Inscription gratuite sur https://francetravail.io → Créer une appli → souscrire "Offres d'emploi v2"
// Secrets GitHub : FT_CLIENT_ID, FT_CLIENT_SECRET
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
  if (!tokenRes.ok) throw new Error(`Auth FT ${tokenRes.status}`)
  const { access_token } = await tokenRes.json()

  const keywords = [
    'administrateur système',
    'admin sys linux',
    'ingénieur système linux',
    'technicien infrastructure',
    'administrateur réseau système',
    'ingénieur infrastructure',
    'devops linux',
  ]
  const seen = new Set()
  const jobs = []

  for (const kw of keywords) {
    const url = new URL('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search')
    url.searchParams.set('motsCles', kw)
    url.searchParams.set('departement', DEPT)
    url.searchParams.set('range', '0-49')

    const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } })
    if (!res.ok) continue
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

// ─── Adzuna (REST + multi-mots-clés + pagination) ────────────────────────────
// Inscription gratuite sur https://developer.adzuna.com (250 req/jour)
// Secrets GitHub : ADZUNA_APP_ID, ADZUNA_APP_KEY
async function fetchAdzuna() {
  const keywords = [
    'administrateur système linux',
    'admin sys',
    'sysadmin',
    'ingénieur infrastructure',
    'technicien système réseau',
    'devops linux',
    'linux administrator',
  ]
  const seen = new Set()
  const jobs = []

  for (const what of keywords) {
    for (const page of [1, 2]) {
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/fr/search/${page}`)
      url.searchParams.set('app_id', process.env.ADZUNA_APP_ID)
      url.searchParams.set('app_key', process.env.ADZUNA_APP_KEY)
      url.searchParams.set('what', what)
      url.searchParams.set('where', CITY)
      url.searchParams.set('distance', '50')
      url.searchParams.set('results_per_page', '50')

      const res = await fetch(url)
      if (!res.ok) break
      const data = await res.json()
      if (!data.results?.length) break

      for (const j of data.results) {
        if (seen.has(j.redirect_url)) continue
        seen.add(j.redirect_url)
        jobs.push({
          title: j.title,
          company: j.company?.display_name || 'Non précisé',
          location: j.location?.display_name || CITY,
          url: j.redirect_url,
          source: 'Adzuna',
          date: j.created?.slice(0, 10) ?? null,
        })
      }
    }
  }
  return jobs
}

// ─── Déduplication ────────────────────────────────────────────────────────────
function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => {
    const key = j.url || `${j.title}|${j.company}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Orchestration ────────────────────────────────────────────────────────────
// Note : APEC, Workday, Indeed, HelloWork bloquent les IPs automatisées (403).
// Seules France Travail et Adzuna exposent des APIs stables sans scraping.
const SOURCES = [
  {
    name: 'France Travail',
    fn: fetchFranceTravail,
    active: () => !!(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET),
    setupUrl: 'https://francetravail.io',
  },
  {
    name: 'Adzuna',
    fn: fetchAdzuna,
    active: () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    setupUrl: 'https://developer.adzuna.com',
  },
]

async function main() {
  const all = []
  const activeSources = []

  for (const { name, fn, active, setupUrl } of SOURCES) {
    if (!active()) {
      console.log(`  ${name} : clés manquantes → ${setupUrl}`)
      continue
    }
    try {
      const jobs = await fn()
      all.push(...jobs)
      activeSources.push(name)
      console.log(`✓ ${name} : ${jobs.length} offres`)
    } catch (e) {
      console.error(`✗ ${name} : ${e.message}`)
    }
  }

  const useDemo = all.length === 0
  if (useDemo) {
    console.log('⚠ Aucune clé API configurée — données de démo')
    all.push(...DEMO_JOBS)
  }

  const unique = dedupe(all)
  unique.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  fs.writeFileSync('public/jobs.json', JSON.stringify({
    updatedAt: new Date().toISOString(),
    demo: useDemo,
    activeSources,
    count: unique.length,
    jobs: unique,
  }, null, 2))

  console.log(`✓ jobs.json : ${unique.length} offres — sources actives : ${activeSources.join(', ') || 'aucune (démo)'}`)
}

main()
