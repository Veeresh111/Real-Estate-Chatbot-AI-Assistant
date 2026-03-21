function safeJsonParse(text, fallback) {
  if (!text || typeof text !== "string") return fallback

  try {
    return JSON.parse(text)
  } catch (err) {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch (innerErr) {
        return fallback
      }
    }
    return fallback
  }
}

module.exports = { safeJsonParse }
