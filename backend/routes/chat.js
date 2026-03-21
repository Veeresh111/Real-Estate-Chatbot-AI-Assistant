const express = require("express")
const router = express.Router()

const { askAI, buildFallbackResponse } = require("../services/ai")

router.post("/", async (req, res) => {
  try {
    const { message, history, language } = req.body

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." })
    }

    const result = await askAI({ message, history, language })
    res.json(result)
  } catch (err) {
    const fallback = buildFallbackResponse(req.body?.language)
    res.json(fallback)
  }
})

module.exports = router
