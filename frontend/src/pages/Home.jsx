import { useEffect, useMemo, useState } from "react"
import { fetchProjects } from "../api"
import ChatWidget from "../components/ChatWidget"

function formatCurrency(value) {
  if (!value) return ""
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value)
}

function Home() {
  const [company, setCompany] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState("")

  useEffect(() => {
    fetchProjects({ publishedOnly: true })
      .then((data) => {
        setCompany(data.company)
        setProjects(data.projects || [])
        if (data.projects?.length) {
          setSelectedId(data.projects[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId]
  )

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">Bhunidhi Developers</p>
          <h1>Premium plotted developments in Bangalore.</h1>
          <p className="subtitle">
            Explore live availability, view project media, and get answers instantly.
          </p>
        </div>
        <div className="hero-card">
          <h3>Projects Overview</h3>
          <p className="muted">{company?.address}</p>
          <div className="stat-grid">
            <div>
              <p className="stat-label">Projects</p>
              <p className="stat-value">{projects.length}</p>
            </div>
            <div>
              <p className="stat-label">City</p>
              <p className="stat-value">{company?.city || "Bangalore"}</p>
            </div>
            <div>
              <p className="stat-label">Contact</p>
              <p className="stat-value">{company?.phone}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Available Sites</h2>
            <p className="muted">Pick a project to view current inventory.</p>
          </div>
          <select
            className="select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="project-grid">
            <div className="card">
              <h3>{selectedProject.name}</h3>
              <p className="muted">{selectedProject.location}</p>
              {selectedProject.coverImageUrl && (
                <img
                  className="project-cover"
                  src={selectedProject.coverImageUrl}
                  alt={`${selectedProject.name} cover`}
                />
              )}
              <p className="summary">{selectedProject.summary}</p>
              {selectedProject.details && <p className="muted">{selectedProject.details}</p>}
              <div className="pill-row">
                <span className="pill">{selectedProject.status}</span>
                <span className="pill">{selectedProject.timeline.possession}</span>
              </div>
              <div className="info-block">
                <h4>Amenities</h4>
                <ul className="list">
                  {selectedProject.amenities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="info-block">
                <h4>Budget Snapshot</h4>
                <p className="muted">
                  Maintenance: {formatCurrency(selectedProject.budget.maintenancePerYear)} / year
                </p>
                <p className="muted">
                  Registration estimate: {selectedProject.budget.registrationEstimatePercent}%
                </p>
                <p className="muted">Stamp duty: {selectedProject.budget.stampDutyPercent}%</p>
              </div>
            </div>

            <div className="card">
              <h4>Available Plots</h4>
              <div className="table">
                {selectedProject.availableSites.map((site) => (
                  <div className="row" key={site.plotNo}>
                    <div>
                      <p className="row-title">Plot {site.plotNo}</p>
                      <p className="muted">
                        {site.sizeSqFt} sq ft - {site.facing}
                      </p>
                    </div>
                    <div className="row-price">{formatCurrency(site.totalPrice)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h4>Surrounding Areas</h4>
              <ul className="list">
                {selectedProject.nearby.map((place) => (
                  <li key={place.name}>
                    {place.name} - {place.distanceKm} km
                  </li>
                ))}
              </ul>
              <div className="info-block">
                <h4>Before / After</h4>
                <p className="muted">{selectedProject.beforeAfter.before}</p>
                <p className="muted">{selectedProject.beforeAfter.after}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {selectedProject && (
        <section className="section media-section">
          <div className="section-header">
            <div>
              <h2>Project Media</h2>
              <p className="muted">Published visuals, maps, and brochures for this project.</p>
            </div>
          </div>
          <div className="media-grid">
            <div className="card">
              <h4>Map View</h4>
              {selectedProject.mapImageUrl ? (
                <img className="media-image" src={selectedProject.mapImageUrl} alt="Project map" />
              ) : (
                <p className="muted">Map image coming soon.</p>
              )}
            </div>
            <div className="card">
              <h4>Gallery</h4>
              {selectedProject.gallery?.length ? (
                <div className="gallery-grid">
                  {selectedProject.gallery.map((url, index) => (
                    <img className="gallery-image" src={url} alt={`Gallery ${index + 1}`} key={url} />
                  ))}
                </div>
              ) : (
                <p className="muted">Gallery images will be published here.</p>
              )}
            </div>
            <div className="card">
              <h4>Brochure</h4>
              {selectedProject.brochureUrl ? (
                <a className="primary" href={selectedProject.brochureUrl} target="_blank" rel="noreferrer">
                  View Brochure
                </a>
              ) : (
                <p className="muted">Brochure not uploaded.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="section chat-section">
        <div className="section-header">
          <div>
            <h2>Ask the AI Assistant</h2>
            <p className="muted">
              Get instant answers, schedule a visit, and share your contact details.
            </p>
          </div>
        </div>
        <ChatWidget company={company} defaultLanguage="en" />
      </section>
    </div>
  )
}

export default Home
