const express = require("express")
const fs = require("fs")
const path = require("path")

const {
  createVideo,
  getVideoStatus,
  downloadVideo,
  createNarrationScript,
  createLongNarrationScript,
  textToSpeech
} = require("../services/ai")
const { getProjectById } = require("../services/projects")

const router = express.Router()

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`
}

function buildVideoPrompt(project, language) {
  if (!project) {
    return "Animated real-estate flythrough of a premium plotted development in Bangalore. Clean aerial map, clear labels, modern layout."
  }

  const before = project.beforeAfter?.before || "Open land"
  const after = project.beforeAfter?.after || "Plotted layout with roads and parks"
  const highlights = (project.mapHighlights || []).join("; ") || "Main access, parks, utilities"
  const amenities = (project.amenities || []).join(", ") || "Essential infrastructure"
  const nearby = (project.nearby || []).map((place) => place.name).join(", ") || "Nearby landmarks"

  return `
Create a smooth animated explainer video for a real-estate plotted development.
Language for on-screen labels: ${language || "English"}.
Project: ${project.name} in ${project.location}.
Show a before/after transformation: ${before} -> ${after}.
Include map highlights: ${highlights}.
Show amenities: ${amenities}.
Show nearby landmarks: ${nearby}.
Style: clean, modern, architectural animation with clear labels.
`.trim()
}

router.post("/", async (req, res) => {
  try {
    const { projectId, language, seconds, size, voice } = req.body
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." })
    }
    const project = await getProjectById(projectId)
    if (!project) {
      return res.status(404).json({ error: "Project not found." })
    }

    const prompt = buildVideoPrompt(project, language)
    const videoJob = await createVideo({ prompt, seconds, size })

    const narration = await createNarrationScript({ projectId, language })
    const audioBuffer = await textToSpeech({
      text: narration,
      voice: voice || "coral",
      format: "mp3"
    })

    const audioDir = path.join(__dirname, "..", "uploads", "audio")
    fs.mkdirSync(audioDir, { recursive: true })
    const audioName = `narration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
    fs.writeFileSync(path.join(audioDir, audioName), audioBuffer)

    const videoId = videoJob.id || videoJob.data?.id
    const status = videoJob.status || videoJob.data?.status || "queued"

    res.json({
      videoId,
      status,
      narration,
      audioUrl: `${getBaseUrl(req)}/uploads/audio/${audioName}`
    })
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(501).json({ error: "Video generation requires OPENAI_API_KEY." })
    }
    res.status(500).json({ error: err.message })
  }
})

router.post("/storyboard", async (req, res) => {
  try {
    const { projectId, language, minutes } = req.body
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." })
    }
    const storyboard = await createLongNarrationScript({
      projectId,
      language,
      minutes: Number(minutes) || 5
    })
    res.json({ storyboard })
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY")) {
      return res.status(501).json({ error: "Storyboard generation requires GEMINI_API_KEY." })
    }
    res.status(500).json({ error: err.message })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const status = await getVideoStatus(id)

    if (status.status === "completed") {
      const videoDir = path.join(__dirname, "..", "uploads", "videos")
      fs.mkdirSync(videoDir, { recursive: true })
      const videoPath = path.join(videoDir, `${id}.mp4`)

      if (!fs.existsSync(videoPath)) {
        const videoBuffer = await downloadVideo(id)
        fs.writeFileSync(videoPath, videoBuffer)
      }

      return res.json({
        status: "completed",
        url: `${getBaseUrl(req)}/uploads/videos/${id}.mp4`
      })
    }

    if (status.status === "failed") {
      return res.status(500).json({ status: "failed", error: "Video generation failed." })
    }

    res.json({
      status: status.status || "queued"
    })
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(501).json({ error: "Video status requires OPENAI_API_KEY." })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
