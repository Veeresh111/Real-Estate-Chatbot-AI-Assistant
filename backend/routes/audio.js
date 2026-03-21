const express = require("express")
const fs = require("fs")
const path = require("path")
const multer = require("multer")

const { textToSpeech, transcribeAudio } = require("../services/ai")

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
})

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`
}

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required." })
    }

    const result = await transcribeAudio({
      buffer: req.file.buffer,
      filename: req.file.originalname || "audio.webm",
      mimeType: req.file.mimetype || "audio/webm",
      language: req.body.language
    })

    res.json({ text: result.text || "" })
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(501).json({ error: "Audio transcription requires OPENAI_API_KEY." })
    }
    res.status(500).json({ error: err.message })
  }
})

router.post("/speech", async (req, res) => {
  try {
    const { text, voice, format } = req.body
    if (!text) {
      return res.status(400).json({ error: "Text is required." })
    }

    const audioBuffer = await textToSpeech({ text, voice, format })
    const audioDir = path.join(__dirname, "..", "uploads", "audio")
    fs.mkdirSync(audioDir, { recursive: true })

    const safeFormat = format || "mp3"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeFormat}`
    const filePath = path.join(audioDir, filename)

    fs.writeFileSync(filePath, audioBuffer)

    res.json({
      url: `${getBaseUrl(req)}/uploads/audio/${filename}`
    })
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(501).json({ error: "Text-to-speech requires OPENAI_API_KEY." })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
