const express = require("express")
const router = express.Router()

const {
  getProjects,
  getProjectById,
  getCompany,
  createProject,
  updateProject,
  deleteProject
} = require("../services/projects")

router.get("/", async (req, res) => {
  try {
    const publishedOnly = req.query.published === "true"
    const [company, projects] = await Promise.all([
      getCompany(),
      getProjects({ publishedOnly })
    ])
    res.json({
      company,
      projects
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const project = await getProjectById(req.params.id)
    if (!project) {
      return res.status(404).json({ error: "Project not found." })
    }
    res.json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post("/", async (req, res) => {
  try {
    const project = await createProject(req.body)
    res.status(201).json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put("/:id", async (req, res) => {
  try {
    const project = await updateProject(req.params.id, req.body)
    if (!project) {
      return res.status(404).json({ error: "Project not found." })
    }
    res.json({ project })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const project = await deleteProject(req.params.id)
    if (!project) {
      return res.status(404).json({ error: "Project not found." })
    }
    res.json({ message: "Project deleted." })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
