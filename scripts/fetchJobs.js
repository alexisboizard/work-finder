
import fs from 'fs'

const jobs = [
  {
    title: "Admin Sys Linux",
    company: "Example Corp",
    location: "Montpellier",
    url: "https://example.com",
    source: "demo"
  }
]

fs.writeFileSync("public/jobs.json", JSON.stringify(jobs, null, 2))
console.log("jobs.json updated")
