import fs from 'fs'

const DEPT = '34'
const CITY = 'Montpellier'
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

const DEMO_JOBS = [
  { title: 'Administrateur Système Linux Senior',     company: 'DataCenter Sud',   location: CITY,          url: 'https://candidat.francetravail.fr/offres/detail/DEMO001', source: 'France Travail', date: daysAgo(1)  },
  { title: 'Technicien Infrastructure N2',            company: 'ITServices34',     location: CITY,          url: 'https://candidat.francetravail.fr/offres/detail/DEMO002', source: 'France Travail', date: daysAgo(2)  },
  { title: 'Admin Sys N2/N3 – Active Directory',      company: 'Capgemini',        location: CITY,          url: 'https://fr.indeed.com/viewjob?jk=DEMO003',               source: 'Indeed',         date: daysAgo(3)  },
  { title: 'Administrateur Linux / Ansible',          company: 'SNCF',             location: CITY,          url: 'https://fr.indeed.com/viewjob?jk=DEMO004',               source: 'Indeed',         date: daysAgo(4)  },
  { title: 'Ingénieur Systèmes VMware / vSphere',     company: 'Cloud Hérault',    location: CITY,          url: 'https://www.adzuna.fr/details/demo005',                  source: 'Adzuna',         date: daysAgo(5)  },
  { title: 'Responsable Infrastructure IT',           company: 'CHU Montpellier',  location: CITY,          url: 'https://www.apec.fr/offres-emploi/detail-offre/DEMO006.html', source: 'APEC',      date: daysAgo(7)  },
  { title: 'Ingénieur Systèmes / Admin Sys',          company: 'Safran',           location: 'Mauguio (34)',url: 'https://www.apec.fr/offres-emploi/detail-offre/DEMO007.html', source: 'APEC',      date: daysAgo(8)  },
  { title: 'Administrateur Systèmes & Réseaux',       company: 'Thales',           location: CITY,          url: 'https://www.hellowork.com/fr-fr/emplois/DEMO008.html',    source: 'HelloWork',      date: daysAgo(10) },
  { title: 'DevOps / Admin Sys – Kubernetes',         company: 'Sopra Steria',     location: CITY,          url: 'https://www.hellowork.com/fr-fr/emplois/DEMO009.html',    source: 'HelloWork',      date: daysAgo(12) },
  { title: 'Administrateur Systèmes Embarqués',       company: 'Airbus Defence',   location: 'Elancourt (34)', url: 'https://airbus.wd3.myworkdayjobs.com/fr-FR/Airbus/DEMO010', source: 'Workday',   date: daysAgo(14) },
]

// ─── RSS parser (no external deps) ───────────────────────────────────────────
function parseRSS(xml) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]
    const tag = name => {
      const t = block.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`, 'i'))
      return t ? t[1].trim() : null
    }
    // <link> is sometimes bare URL between tags without CDATA
    const link = tag('link') || tag('guid')
    items.push({ title: tag('title'), link, company: tag('source') || tag('author'), pubDate: tag('pubDate') || tag('dc:date') })
  }
  return items
}

function toDate(str) {
  if (!str) return null
  try { return new Date(str).toISOString().slice(0, 10) } catch { return null }
}

async function rssGet(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// ─── France Travail (OAuth2 + REST) ──────────────────────────────────────────
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

  const keywords = ['administrateur système', 'admin sys linux', 'ingénieur système linux']
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

// ─── Adzuna (REST, clé requise) ───────────────────────────────────────────────
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

// ─── Indeed (RSS, sans clé) ───────────────────────────────────────────────────
async function fetchIndeed() {
  const searches = ['administrateur+syst%C3%A8me+linux', 'admin+sys', 'ing%C3%A9nieur+syst%C3%A8me']
  const seen = new Set()
  const jobs = []

  for (const q of searches) {
    const xml = await rssGet(`https://fr.indeed.com/rss?q=${q}&l=Montpellier&radius=30&sort=date`)
    for (const item of parseRSS(xml)) {
      if (!item.link || seen.has(item.link)) continue
      seen.add(item.link)
      jobs.push({
        title: item.title || 'Sans titre',
        company: item.company || 'Entreprise',
        location: CITY,
        url: item.link,
        source: 'Indeed',
        date: toDate(item.pubDate),
      })
    }
  }
  return jobs
}

// ─── APEC (RSS, sans clé) ─────────────────────────────────────────────────────
async function fetchAPEC() {
  const xml = await rssGet(
    `https://www.apec.fr/offres-emploi/offres-emploi.html/rss?motsCles=administrateur+syst%C3%A8me&lieux=133900`
  )
  return parseRSS(xml).filter(i => i.link).map(i => ({
    title: i.title || 'Sans titre',
    company: i.company || 'Non précisé',
    location: CITY,
    url: i.link,
    source: 'APEC',
    date: toDate(i.pubDate),
  }))
}

// ─── HelloWork (RSS, sans clé) ────────────────────────────────────────────────
async function fetchHelloWork() {
  const xml = await rssGet(
    `https://www.hellowork.com/fr-fr/emplois.rss?k=administrateur+syst%C3%A8me&l=Montpellier&d=30km&s=date`
  )
  return parseRSS(xml).filter(i => i.link).map(i => ({
    title: i.title || 'Sans titre',
    company: i.company || 'Non précisé',
    location: CITY,
    url: i.link,
    source: 'HelloWork',
    date: toDate(i.pubDate),
  }))
}

// ─── Workday (grands groupes) ─────────────────────────────────────────────────
// Beaucoup de grands groupes français utilisent Workday : Safran, Thales, Airbus,
// Capgemini, Atos/Eviden, Bouygues, EDF... L'API REST est publique mais non documentée.
const WORKDAY_COMPANIES = [
  { name: 'Safran',        tenant: 'safran',       path: 'safran'         },
  { name: 'Thales',        tenant: 'thalesgroup',  path: 'Thales'         },
  { name: 'Airbus',        tenant: 'ag',           path: 'Airbus'         },
  { name: 'Capgemini',     tenant: 'capgemini',    path: 'Capgemini'      },
  { name: 'Atos / Eviden', tenant: 'atos',         path: 'Atos'           },
  { name: 'EDF',           tenant: 'edf',          path: 'EDF'            },
  { name: 'Bouygues',      tenant: 'bouygues',     path: 'Bouygues'       },
]

async function fetchWorkday() {
  const jobs = []

  for (const { name, tenant, path } of WORKDAY_COMPANIES) {
    try {
      const url = `https://${tenant}.wd3.myworkdayjobs.com/wday/cxs/${tenant}/${path}/jobs`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20, offset: 0, searchText: 'administrateur système linux' }),
      })
      if (!res.ok) continue

      const data = await res.json()
      const postings = data.jobPostings ?? []

      for (const p of postings) {
        // Filtrer sur la région si la localisation est disponible
        const loc = (p.locationsText || p.location || '').toLowerCase()
        if (loc && !loc.includes('montpellier') && !loc.includes('hérault') && !loc.includes('34') && !loc.includes('occitanie')) continue

        jobs.push({
          title: p.title || 'Sans titre',
          company: name,
          location: p.locationsText || 'France',
          url: `https://${tenant}.wd3.myworkdayjobs.com/fr-FR/${path}/job/${p.externalPath ?? ''}`,
          source: 'Workday',
          date: p.postedOn ? toDate(p.postedOn) : null,
        })
      }
      if (postings.length > 0) console.log(`  Workday/${name} : ${postings.length} offres (${jobs.filter(j => j.company === name).length} dans la région)`)
    } catch {
      // Silently skip — l'API Workday n'est pas garantie
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
const SOURCES = [
  { name: 'France Travail', fn: fetchFranceTravail, active: () => !!(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET) },
  { name: 'Adzuna',         fn: fetchAdzuna,        active: () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)  },
  { name: 'Indeed',         fn: fetchIndeed,        active: () => true },
  { name: 'APEC',           fn: fetchAPEC,          active: () => true },
  { name: 'HelloWork',      fn: fetchHelloWork,     active: () => true },
  { name: 'Workday',        fn: fetchWorkday,       active: () => true },
]

async function main() {
  const all = []

  for (const { name, fn, active } of SOURCES) {
    if (!active()) { console.log(`  ${name} : clés manquantes`); continue }
    try {
      const jobs = await fn()
      all.push(...jobs)
      console.log(`✓ ${name} : ${jobs.length} offres`)
    } catch (e) {
      console.error(`✗ ${name} : ${e.message}`)
    }
  }

  const useDemo = all.length === 0
  if (useDemo) {
    console.log('⚠ Aucune source active — données de démo')
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
    count: unique.length,
    jobs: unique,
  }, null, 2))

  console.log(`✓ jobs.json : ${unique.length} offres (${useDemo ? 'démo' : 'live'})`)
}

main()
