const fs = require("fs")
const path = require("path")

const Company = require("../models/Company")
const Project = require("../models/Project")

function slugify(value) {
  const base = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base || "project"
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function toNearby(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        name: String(item.name || item).trim(),
        distanceKm: toNumber(item.distanceKm, 0)
      }))
      .filter((item) => item.name)
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [namePart, distancePart] = segment.split(":").map((part) => part.trim())
        return {
          name: namePart,
          distanceKm: toNumber(distancePart, 0)
        }
      })
      .filter((item) => item.name)
  }

  return []
}

function normalizeSite(site) {
  const sizeSqFt = toNumber(site.sizeSqFt, 1200)
  const pricePerSqFt = toNumber(site.pricePerSqFt, 6500)
  const totalPrice = toNumber(site.totalPrice, sizeSqFt * pricePerSqFt)

  return {
    plotNo: String(site.plotNo || "A-01"),
    sizeSqFt,
    pricePerSqFt,
    totalPrice,
    facing: String(site.facing || "East")
  }
}

function normalizeSites(payload) {
  if (Array.isArray(payload.availableSites) && payload.availableSites.length) {
    return payload.availableSites.map(normalizeSite)
  }

  return [
    normalizeSite({
      plotNo: payload.plotNo || payload.siteId || "A-01",
      sizeSqFt: payload.sizeSqFt,
      pricePerSqFt: payload.pricePerSqFt,
      totalPrice: payload.totalPrice,
      facing: payload.facing
    })
  ]
}

function normalizeProject(payload = {}) {
  const name = String(payload.name || "").trim() || "Untitled Project"
  const id = String(payload.id || "").trim() || `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`

  const amenities = toArray(payload.amenities)
  const mapHighlights = toArray(payload.mapHighlights)
  const nearby = toNearby(payload.nearby)
  const gallery = toArray(payload.gallery)
  const languages = toArray(payload.languages)

  return {
    id,
    name,
    status: payload.status || "Planning",
    location: payload.location || "Bangalore",
    summary: payload.summary || "Plotted development with modern infrastructure.",
    details: payload.details || "",
    storyboardNotes: payload.storyboardNotes || "",
    coverImageUrl: payload.coverImageUrl || payload.media?.coverImageUrl || "",
    gallery,
    mapImageUrl: payload.mapImageUrl || payload.media?.mapImageUrl || "",
    videoUrl: payload.videoUrl || payload.media?.videoUrl || "",
    brochureUrl: payload.brochureUrl || payload.media?.brochureUrl || "",
    bgmUrl: payload.bgmUrl || payload.media?.bgmUrl || "",
    isPublished: typeof payload.isPublished === "boolean" ? payload.isPublished : Boolean(payload.isPublished),
    languages,
    availableSites: normalizeSites(payload),
    amenities: amenities.length ? amenities : ["Entry arch", "Internal roads", "Water line connection"],
    nearby: nearby.length
      ? nearby
      : [
          { name: "Upcoming metro", distanceKm: 4.0 },
          { name: "Tech park", distanceKm: 6.5 }
        ],
    beforeAfter: {
      before: payload.before || payload.beforeAfter?.before || "Open land with basic access.",
      after: payload.after || payload.beforeAfter?.after || "Plotted layout with roads, lighting, and parks."
    },
    mapHighlights: mapHighlights.length ? mapHighlights : ["Main 60-ft road access", "Central green spine"],
    budget: {
      maintenancePerYear: toNumber(payload.maintenancePerYear ?? payload.budget?.maintenancePerYear, 0),
      registrationEstimatePercent: toNumber(
        payload.registrationEstimatePercent ?? payload.budget?.registrationEstimatePercent,
        0
      ),
      stampDutyPercent: toNumber(payload.stampDutyPercent ?? payload.budget?.stampDutyPercent, 0)
    },
    timeline: {
      possession: payload.possession || payload.timeline?.possession || "To be announced",
      developmentPhase: payload.developmentPhase || payload.timeline?.developmentPhase || "Planning",
      lastUpdated:
        payload.lastUpdated || payload.timeline?.lastUpdated || new Date().toISOString().slice(0, 10)
    }
  }
}

async function ensureSeedData() {
  const [projectCount, companyCount] = await Promise.all([
    Project.countDocuments(),
    Company.countDocuments()
  ])

  if (projectCount && companyCount) return

  const filePath = path.join(__dirname, "..", "data", "projects.json")
  const raw = fs.readFileSync(filePath, "utf-8")
  const data = JSON.parse(raw)

  if (!companyCount && data.company) {
    await Company.create(data.company)
  }

  if (!projectCount && Array.isArray(data.projects)) {
    const normalized = data.projects.map(normalizeProject)
    await Project.insertMany(normalized)
  }

  await Project.updateMany(
    { isPublished: { $exists: false } },
    { $set: { isPublished: true } }
  )
}

async function getProjects({ publishedOnly } = {}) {
  const query = publishedOnly ? { isPublished: true } : {}
  return Project.find(query).lean()
}

async function getCompany() {
  return Company.findOne().lean()
}

async function getProjectById(id) {
  return Project.findOne({ id }).lean()
}

async function createProject(payload) {
  const project = normalizeProject(payload)
  return Project.create(project)
}

async function updateProject(id, payload) {
  const existing = await Project.findOne({ id }).lean()
  if (!existing) return null

  const merged = normalizeProject({
    ...existing,
    ...payload,
    id: existing.id
  })

  if (typeof payload.isPublished === "boolean") {
    merged.isPublished = payload.isPublished
  } else {
    merged.isPublished = existing.isPublished
  }

  return Project.findOneAndUpdate({ id }, merged, { new: true }).lean()
}

async function deleteProject(id) {
  return Project.findOneAndDelete({ id }).lean()
}

module.exports = {
  ensureSeedData,
  getProjects,
  getProjectById,
  getCompany,
  createProject,
  updateProject,
  deleteProject
}
