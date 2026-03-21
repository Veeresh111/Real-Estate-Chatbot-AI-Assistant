const axios = require("axios")
const FormData = require("form-data")

const { getCompany, getProjects, getProjectById } = require("./projects")
const { safeJsonParse } = require("../utils/safeJson")

const OPENAI_BASE_URL = "https://api.openai.com/v1"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe"
const VIDEO_MODEL = process.env.OPENAI_VIDEO_MODEL || "sora-2"

const LANGUAGE_MAP = {
  en: "English",
  kn: "Kannada",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu"
}

function resolveLanguage(language) {
  return LANGUAGE_MAP[language] || language || "English"
}

function sanitizeReply(text) {
  if (!text) return ""
  let cleaned = String(text)
  cleaned = cleaned.replace(/\*\*/g, "")
  cleaned = cleaned.replace(/\*/g, "")
  cleaned = cleaned.replace(/[`_]/g, "")
  cleaned = cleaned.replace(/(^|\n)\s*\d+[.)]\s+/g, " ")
  cleaned = cleaned.replace(/(^|\n)\s*[-•]\s+/g, " ")
  cleaned = cleaned.replace(/[\r\n]+/g, " ")
  cleaned = cleaned.replace(/\s+/g, " ").trim()
  return cleaned
}

function buildFallbackResponse(language) {
  return {
    reply: "Thanks for reaching out. Could you share your preferred location and budget range?",
    language: language || "en",
    lead_request: true,
    lead: { name: "", phone: "", email: "", budget: "", siteId: "", preferredTime: "" }
  }
}

const FALLBACK_TEMPLATES = {
  en: {
    greeting: "Hi! How can I help you with plots, pricing, or site visits?",
    budgetMatch: (items) =>
      `Based on your budget, here are ${items.length} available plot options: ${items.join("; ")}. Would you like a site visit?`,
    budgetNoMatch: (minPrice) =>
      `Thanks for sharing your budget. Our current sites start around ${minPrice}. Would you like options slightly above your range?`,
    availability: (summary) =>
      `Here is the latest availability: ${summary}. Share your budget and preferred location for tailored options.`,
    generic: "Thanks for reaching out. Could you share your preferred location and budget range?"
  },
  hi: {
    greeting: "नमस्ते! मैं प्लॉट्स, कीमत और साइट विज़िट में आपकी मदद कर सकता हूँ।",
    budgetMatch: (items) =>
      `आपके बजट के अनुसार ${items.length} प्लॉट उपलब्ध हैं: ${items.join("; ")}. क्या आप साइट विज़िट चाहेंगे?`,
    budgetNoMatch: (minPrice) =>
      `धन्यवाद। हमारी साइट्स की शुरुआती कीमत लगभग ${minPrice} है। क्या आप थोड़े अधिक बजट विकल्प देखना चाहेंगे?`,
    availability: (summary) =>
      `वर्तमान उपलब्धता: ${summary}. कृपया अपना बजट और पसंदीदा लोकेशन बताएं।`,
    generic: "धन्यवाद। कृपया अपना पसंदीदा लोकेशन और बजट रेंज बताएं।"
  },
  kn: {
    greeting: "ನಮಸ್ಕಾರ! ಪ್ಲಾಟ್‌ಗಳು, ಬೆಲೆ ಹಾಗೂ ಸೈಟ್ ವಿಸಿಟ್ ಬಗ್ಗೆ ನೆರವು ಬೇಕಾ?",
    budgetMatch: (items) =>
      `ನಿಮ್ಮ ಬಜೆಟ್‌ಗೆ ತಕ್ಕಂತೆ ${items.length} ಪ್ಲಾಟ್‌ಗಳು ಲಭ್ಯವಿವೆ: ${items.join("; ")}. ಸೈಟ್ ವಿಸಿಟ್ ಬೇಕೆ?`,
    budgetNoMatch: (minPrice) =>
      `ಧನ್ಯವಾದಗಳು. ನಮ್ಮ ಸೈಟ್‌ಗಳ ಆರಂಭಿಕ ದರ ಸುಮಾರು ${minPrice}. ಸ್ವಲ್ಪ ಹೆಚ್ಚಿನ ಬಜೆಟ್ ಆಯ್ಕೆಗಳನ್ನು ನೋಡಬೇಕೇ?`,
    availability: (summary) =>
      `ಪ್ರಸ್ತುತ ಲಭ್ಯತೆ: ${summary}. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬಜೆಟ್ ಮತ್ತು ಇಷ್ಟದ ಸ್ಥಳವನ್ನು ತಿಳಿಸಿ.`,
    generic: "ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಇಷ್ಟದ ಸ್ಥಳ ಮತ್ತು ಬಜೆಟ್ ಶ್ರೇಣಿಯನ್ನು ಹಂಚಿಕೊಳ್ಳಬಹುದೇ?"
  },
  ta: {
    greeting: "வணக்கம்! ப்ளாட்டுகள், விலை, தள விஜிட் குறித்து உதவி வேண்டுமா?",
    budgetMatch: (items) =>
      `உங்கள் பட்ஜெட்டிற்கு பொருந்தும் ${items.length} ப்ளாட்டுகள் உள்ளன: ${items.join("; ")}. தள விஜிட் வேண்டுமா?`,
    budgetNoMatch: (minPrice) =>
      `நன்றி. எங்கள் தளங்கள் சுமார் ${minPrice} முதல் தொடங்குகின்றன. உங்கள் பட்ஜெட்டை சிறிது உயர்த்தி பார்க்க விருப்பமா?`,
    availability: (summary) =>
      `தற்போதைய கிடைப்புகள்: ${summary}. உங்கள் பட்ஜெட் மற்றும் விருப்ப இடத்தை தெரிவிக்கவும்.`,
    generic: "நன்றி. உங்கள் விருப்பமான இடம் மற்றும் பட்ஜெட் வரம்பை பகிரவும்."
  },
  te: {
    greeting: "నమస్కారం! ప్లాట్లు, ధరలు లేదా సైట్ విజిట్ గురించి సహాయం కావాలా?",
    budgetMatch: (items) =>
      `మీ బడ్జెట్‌కు సరిపోయే ${items.length} ప్లాట్లు ఉన్నాయి: ${items.join("; ")}. సైట్ విజిట్ కావాలా?`,
    budgetNoMatch: (minPrice) =>
      `ధన్యవాదాలు. మా సైట్లు సుమారు ${minPrice} నుండి ప్రారంభమవుతాయి. మీ బడ్జెట్ కాస్త పెంచి చూడాలా?`,
    availability: (summary) =>
      `ప్రస్తుత లభ్యత: ${summary}. దయచేసి మీ బడ్జెట్ మరియు ఇష్టమైన స్థలాన్ని చెప్పండి.`,
    generic: "ధన్యవాదాలు. మీకు ఇష్టమైన లొకేషన్ మరియు బడ్జెట్ పరిధిని పంచుకోండి."
  }
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "₹0"
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value)
  } catch (err) {
    return `₹${Math.round(value).toLocaleString("en-IN")}`
  }
}

function parseBudget(message) {
  if (!message) return null
  const text = String(message).toLowerCase()
  const numberMatch = text.match(/(\d+(\.\d+)?)/)
  if (!numberMatch) return null
  const value = Number(numberMatch[1])
  if (!Number.isFinite(value)) return null

  if (text.includes("crore") || text.includes("cr")) {
    return value * 10000000
  }
  if (text.includes("lakh") || text.includes("lakhs") || text.includes("lac")) {
    return value * 100000
  }
  if (value < 1000) {
    return value * 100000
  }
  return value
}

function isGreeting(message) {
  const text = String(message || "").trim().toLowerCase()
  if (!text) return true
  const greetings = ["hi", "hello", "hey", "namaste", "namaskara", "vanakkam", "namaskaram", "hii"]
  return greetings.some((word) => text === word || text.startsWith(`${word} `))
}

function isAffirmation(message) {
  const text = String(message || "").trim().toLowerCase()
  const affirmations = [
    "yes",
    "yeah",
    "yep",
    "ok",
    "okay",
    "sure",
    "please",
    "haan",
    "han",
    "ha",
    "haa",
    "haanji",
    "ji",
    "yes please"
  ]
  return affirmations.includes(text)
}

function isOfficeQuery(message) {
  const text = String(message || "").toLowerCase()
  const keywords = ["office", "address", "location", "how to visit", "visit office", "reach", "direction"]
  return keywords.some((word) => text.includes(word))
}

function findLastAssistantMessage(history) {
  if (!Array.isArray(history)) return ""
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "assistant") {
      return String(history[i]?.content || history[i]?.text || "")
    }
  }
  return ""
}

function isAvailabilityQuery(message) {
  const text = String(message || "").toLowerCase()
  const keywords = ["available", "availability", "plots", "plot", "sites", "site", "price", "pricing"]
  return keywords.some((word) => text.includes(word))
}

function buildDeterministicReply({ message, language, projects, company, history }) {
  const lang = language || "en"
  const template = FALLBACK_TEMPLATES[lang] || FALLBACK_TEMPLATES.en
  const budget = parseBudget(message)
  const allSites = (projects || []).flatMap((project) =>
    (project.availableSites || []).map((site) => ({
      projectName: project.name,
      plotNo: site.plotNo,
      sizeSqFt: site.sizeSqFt,
      facing: site.facing,
      totalPrice: Number(site.totalPrice || 0)
    }))
  )

  if (isOfficeQuery(message) && company) {
    const address = company.address || company.city || "Bangalore"
    const phone = company.phone ? `Call us at ${company.phone}.` : ""
    const email = company.email ? `Email: ${company.email}.` : ""
    return `Our office is in ${address}. ${phone} ${email}`.trim()
  }

  if (isAffirmation(message)) {
    const lastAssistant = findLastAssistantMessage(history)
    if (lastAssistant.toLowerCase().includes("visit")) {
      return "Great! Please share your name, phone number, and a preferred date/time for the site visit."
    }
    return template.generic
  }

  if (isGreeting(message)) {
    return template.greeting
  }

  if (budget && allSites.length) {
    const matches = allSites
      .filter((site) => site.totalPrice && site.totalPrice <= budget)
      .sort((a, b) => a.totalPrice - b.totalPrice)
      .slice(0, 3)

    if (matches.length) {
      const items = matches.map(
        (site) =>
          `${site.projectName} Plot ${site.plotNo} (${site.sizeSqFt} sq ft, ${site.facing}, ${formatCurrency(site.totalPrice)})`
      )
      return template.budgetMatch(items)
    }

    const min = Math.min(...allSites.map((site) => site.totalPrice).filter(Boolean))
    return template.budgetNoMatch(formatCurrency(min))
  }

  if (allSites.length && isAvailabilityQuery(message)) {
    const summary = allSites
      .slice(0, 3)
      .map(
        (site) =>
          `${site.projectName} Plot ${site.plotNo} ${formatCurrency(site.totalPrice)}`
      )
      .join("; ")
    return template.availability(summary)
  }

  return template.generic
}

function getOpenAIHeaders() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  }
}

function getGeminiHeaders() {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY")
  }

  return {
    "x-goog-api-key": GEMINI_API_KEY,
    "Content-Type": "application/json"
  }
}

function toGeminiContents(messages) {
  return messages.map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }]
  }))
}

async function geminiGenerateContent({ systemPrompt, messages, temperature = 0.3, responseMimeType }) {
  const payload = {
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature
    }
  }

  if (responseMimeType) {
    payload.generationConfig.responseMimeType = responseMimeType
  }

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    }
  }

  async function sendRequest(body, useQueryKey) {
    const url = useQueryKey
      ? `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
      : `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`
    return axios.post(url, body, {
      headers: useQueryKey ? { "Content-Type": "application/json" } : getGeminiHeaders(),
      timeout: 20000
    })
  }

  let response
  try {
    response = await sendRequest(payload, false)
  } catch (err) {
    const status = err.response?.status
    const message = err.response?.data?.error?.message || err.message || ""
    const shouldTryQueryKey =
      status === 401 || status === 403 || message.toLowerCase().includes("api key")

    if (responseMimeType) {
      delete payload.generationConfig.responseMimeType
      try {
        response = await sendRequest(payload, false)
      } catch (innerErr) {
        if (shouldTryQueryKey) {
          response = await sendRequest(payload, true)
        } else {
          throw innerErr
        }
      }
    } else if (shouldTryQueryKey) {
      response = await sendRequest(payload, true)
    } else {
      throw err
    }
  }

  const parts = response.data?.candidates?.[0]?.content?.parts || []
  return parts.map((part) => part.text || "").join("").trim()
}

function formatProjectsForPrompt(projects) {
  return (projects || [])
    .map((project) => {
      const sites = (project.availableSites || [])
        .map((site) => `${site.plotNo} (${site.sizeSqFt} sq ft, ${site.facing}, total ${site.totalPrice})`)
        .join("; ") || "No active sites listed"

      const nearby = (project.nearby || [])
        .map((place) => `${place.name} ~${place.distanceKm} km`)
        .join("; ") || "Nearby details pending"

      const amenities = (project.amenities || []).join(", ") || "Amenities to be confirmed"
      const highlights = (project.mapHighlights || []).join("; ") || "Highlights to be confirmed"
      const before = project.beforeAfter?.before || "Before details pending"
      const after = project.beforeAfter?.after || "After details pending"
      const budget = project.budget || {}
      const timeline = project.timeline || {}
      const details = project.details || ""
      const languages = (project.languages || []).join(", ")

      return [
        `Project ID: ${project.id}`,
        `Name: ${project.name}`,
        `Status: ${project.status}`,
        `Location: ${project.location}`,
        `Summary: ${project.summary}`,
        details ? `Details: ${details}` : null,
        `Available sites: ${sites}`,
        `Amenities: ${amenities}`,
        `Nearby: ${nearby}`,
        `Before/After: ${before} -> ${after}`,
        `Map highlights: ${highlights}`,
        `Budget notes: maintenance ${budget.maintenancePerYear} per year, registration estimate ${budget.registrationEstimatePercent}%, stamp duty ${budget.stampDutyPercent}%`,
        `Timeline: ${timeline.possession} (${timeline.developmentPhase})`,
        languages ? `Preferred languages: ${languages}` : null
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")
}

async function buildSystemPrompt(language) {
  const company = (await getCompany()) || {}
  const projects = await getProjects()
  const projectSummary = formatProjectsForPrompt(projects)
  const languageCode = language || "en"
  const languageName = resolveLanguage(language)

  return `
You are the Bhunidhi Developers AI assistant for real estate clients in Bangalore.
Always be accurate, concise, and helpful. If a detail is unknown, say so and offer to connect the user to sales.
You must rely on the project data provided below; do not invent new projects or pricing.
All replies must be in ${languageName}. Do not reply in any other language.
Set the "language" field to "${languageCode}" exactly.

Company details:
- Name: ${company.name || "Bhunidhi Developers"}
- City: ${company.city || "Bangalore"}
- Contact phone: ${company.phone || "Not provided"}
- Contact email: ${company.email || "Not provided"}

Project data:
${projectSummary}

Primary goals:
1) Explain the project, site availability, budget, development, and surrounding areas.
2) Encourage qualified leads and collect contact details when the user shows buying intent.
3) Answer in the user's preferred language (${languageName}).

Style rules:
- Write plain sentences only.
- Do not use markdown, bullets, numbering, or asterisks.
- Avoid special formatting and keep the reply easy to read.

Output rules (strict):
- Return ONLY valid JSON with this shape:
{
  "reply": "string",
  "language": "string",
  "lead_request": boolean,
  "lead": {
    "name": "string or empty",
    "phone": "string or empty",
    "email": "string or empty",
    "budget": "string or empty",
    "siteId": "string or empty",
    "preferredTime": "string or empty"
  }
}
- If you do not have lead info, set "lead" fields to empty strings.
- Set lead_request=true only when user shows buying intent (price, visit, availability, booking, payment, timeline).
- Ask for missing lead details politely when lead_request=true.
- Keep replies short and action oriented.
`.trim()
}

async function askAI({ message, history = [], language }) {
  const safeHistory = Array.isArray(history)
    ? history.slice(-8).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || item.text || "")
      }))
    : []

  const systemPrompt = await buildSystemPrompt(language)
  let raw = ""
  try {
    raw = await geminiGenerateContent({
      systemPrompt,
      messages: [...safeHistory, { role: "user", content: message }],
      temperature: 0.3,
      responseMimeType: "application/json"
    })
  } catch (err) {
    console.error("Gemini chat failed:", err.response?.data || err.message)
    const [projects, company] = await Promise.all([getProjects(), getCompany()])
    const replyText = buildDeterministicReply({ message, language, projects, company, history: safeHistory })
    return {
      reply: sanitizeReply(replyText),
      language: language || "en",
      lead_request: true,
      lead: { name: "", phone: "", email: "", budget: "", siteId: "", preferredTime: "" }
    }
  }
  const fallback = {
    reply: "Thanks for reaching out. Could you share what site or budget you are looking for?",
    language: language || "en",
    lead_request: true,
    lead: { name: "", phone: "", email: "", budget: "", siteId: "", preferredTime: "" }
  }

  const parsed = safeJsonParse(raw, fallback)
  if (!parsed?.reply) {
    const [projects, company] = await Promise.all([getProjects(), getCompany()])
    const replyText = buildDeterministicReply({ message, language, projects, company, history: safeHistory })
    return {
      reply: sanitizeReply(replyText),
      language: language || "en",
      lead_request: true,
      lead: { name: "", phone: "", email: "", budget: "", siteId: "", preferredTime: "" }
    }
  }
  return {
    reply: sanitizeReply(parsed.reply || fallback.reply),
    language: parsed.language || language || fallback.language,
    lead_request: Boolean(parsed.lead_request),
    lead: {
      name: parsed.lead?.name || "",
      phone: parsed.lead?.phone || "",
      email: parsed.lead?.email || "",
      budget: parsed.lead?.budget || "",
      siteId: parsed.lead?.siteId || "",
      preferredTime: parsed.lead?.preferredTime || ""
    }
  }
}

async function createNarrationScript({ projectId, language }) {
  const project = await getProjectById(projectId)
  if (!project) {
    return "Project details are being prepared by Bhunidhi Developers. Our team will share the full site walk-through shortly."
  }

  const sites = (project.availableSites || []).map((site) => `${site.plotNo} ${site.sizeSqFt} sq ft`)
  const amenities = (project.amenities || []).join(", ") || "Essential infrastructure"
  const nearby = (project.nearby || []).map((place) => `${place.name} ${place.distanceKm} km`)
  const before = project.beforeAfter?.before || "Open land"
  const after = project.beforeAfter?.after || "Plotted layout"

  const prompt = `
Create a short narration script for an animated real-estate video.
Language: ${resolveLanguage(language)}
Project: ${project.name} (${project.location})
Key points: ${project.summary}
Available sites: ${sites.join(", ")}
Amenities: ${amenities}
Nearby: ${nearby.join(", ")}
Before/After: ${before} -> ${after}
Keep it under 140 words and end with a call-to-action to contact sales.
`.trim()

  const response = await geminiGenerateContent({
    systemPrompt: "You write short, clear narration scripts for real-estate videos.",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  })

  return response || ""
}

async function createLongNarrationScript({ projectId, language, minutes = 5 }) {
  const project = await getProjectById(projectId)
  if (!project) {
    return "Project details are being prepared by Bhunidhi Developers. Our team will share the full site walk-through shortly."
  }

  const sites = (project.availableSites || []).map((site) => `${site.plotNo} ${site.sizeSqFt} sq ft`)
  const amenities = (project.amenities || []).join(", ") || "Essential infrastructure"
  const nearby = (project.nearby || []).map((place) => `${place.name} ${place.distanceKm} km`)
  const before = project.beforeAfter?.before || "Open land"
  const after = project.beforeAfter?.after || "Plotted layout"
  const details = project.details || project.summary || ""
  const storyboardNotes = project.storyboardNotes || ""

  const prompt = `
Create a detailed narration script and scene plan for a ${minutes}-minute animated real-estate walkthrough video.
Language: ${resolveLanguage(language)}
Project: ${project.name} (${project.location})
Details: ${details}
Notes from the developer: ${storyboardNotes}
Available sites: ${sites.join(", ")}
Amenities: ${amenities}
Nearby: ${nearby.join(", ")}
Before/After: ${before} -> ${after}
Requirements:
- Provide 8 to 12 scenes with timestamps.
- Include on-screen text suggestions, visual direction, and narration.
- End with a strong call-to-action to contact sales.
Return as JSON with keys: narration, scenes (array of {time, visual, onScreenText, voiceover, musicCue}).
`.trim()

  const response = await geminiGenerateContent({
    systemPrompt: "You create long-form video scripts and scene plans for real-estate marketing.",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    responseMimeType: "application/json"
  })

  return response || ""
}

async function textToSpeech({ text, voice = "coral", format = "mp3" }) {
  const response = await axios.post(
    `${OPENAI_BASE_URL}/audio/speech`,
    {
      model: TTS_MODEL,
      voice,
      input: text,
      response_format: format
    },
    {
      headers: {
        ...getOpenAIHeaders(),
        "Content-Type": "application/json"
      },
      responseType: "arraybuffer"
    }
  )

  return Buffer.from(response.data)
}

async function transcribeAudio({ buffer, filename, mimeType, language }) {
  const form = new FormData()
  form.append("model", TRANSCRIBE_MODEL)
  form.append("file", buffer, { filename, contentType: mimeType })

  if (language) {
    form.append("language", language)
  }

  const response = await axios.post(`${OPENAI_BASE_URL}/audio/transcriptions`, form, {
    headers: {
      ...getOpenAIHeaders(),
      ...form.getHeaders()
    }
  })

  return response.data
}

async function createVideo({ prompt, seconds = 8, size = "1280x720" }) {
  const form = new FormData()
  form.append("model", VIDEO_MODEL)
  form.append("prompt", prompt)
  form.append("seconds", String(seconds))
  form.append("size", size)

  const response = await axios.post(`${OPENAI_BASE_URL}/videos`, form, {
    headers: {
      ...getOpenAIHeaders(),
      ...form.getHeaders()
    }
  })

  return response.data
}

async function getVideoStatus(videoId) {
  const response = await axios.get(`${OPENAI_BASE_URL}/videos/${videoId}`, {
    headers: getOpenAIHeaders()
  })
  return response.data
}

async function downloadVideo(videoId) {
  const response = await axios.get(`${OPENAI_BASE_URL}/videos/${videoId}/content`, {
    headers: getOpenAIHeaders(),
    responseType: "arraybuffer"
  })
  return Buffer.from(response.data)
}

module.exports = {
  buildFallbackResponse,
  askAI,
  createNarrationScript,
  createLongNarrationScript,
  textToSpeech,
  transcribeAudio,
  createVideo,
  getVideoStatus,
  downloadVideo
}
