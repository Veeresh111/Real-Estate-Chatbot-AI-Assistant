import { useEffect, useRef, useState } from "react"
import { createLead, sendMessage } from "../api"
import { resolveLocale } from "../utils/locale"

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "kn", label: "Kannada" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" }
]

const BROWSER_SPEECH_RATE = 0.95
const BROWSER_SPEECH_PITCH = 1
const SAMPLE_TEXT = {
  en: "Hello, this is the Bhunidhi assistant speaking.",
  hi: "नमस्ते, यह भुनिधि सहायक की आवाज़ है।",
  ta: "வணக்கம், இது புனிதி உதவியாளரின் குரல்.",
  kn: "ನಮಸ್ಕಾರ, ಇದು ಭುನಿಧಿ ಸಹಾಯಕರ ಧ್ವನಿ.",
  te: "నమస్కారం, ఇది భునిధి సహాయకుడి గొంతు."
}

const FALLBACK_REPLY = {
  en: "Thanks for reaching out. Please share your preferred location and budget range.",
  kn: "ಧನ್ಯವಾದಗಳು. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಷ್ಟದ ಸ್ಥಳ ಮತ್ತು ಬಜೆಟ್ ಶ್ರೇಣಿಯನ್ನು ತಿಳಿಸಿ.",
  hi: "धन्यवाद। कृपया अपना पसंदीदा स्थान और बजट रेंज बताएं।",
  ta: "நன்றி. தயவுசெய்து உங்கள் விருப்பமான இடம் மற்றும் பட்ஜெட் வரம்பை பகிரவும்.",
  te: "ధన్యవాదాలు. దయచేసి మీ ఇష్టமான స్థలం மற்றும் బడ్జெட் పరిధిని చెప్పండి.",
}
function scoreBrowserVoice(voice, locale, language) {
  const voiceLang = String(voice?.lang || "").toLowerCase()
  const localeLower = String(locale || "").toLowerCase()
  const languageLower = String(language || "").toLowerCase()
  const name = String(voice?.name || "").toLowerCase()
  let score = 0

  if (voiceLang === localeLower) score += 8
  if (voiceLang.startsWith(`${languageLower}-`)) score += 5
  if (voiceLang.startsWith(languageLower)) score += 4
  if (voiceLang === "en-in" && languageLower === "en") score += 3

  if (name.includes("india") || name.includes("indian")) score += 4
  if (name.includes("hindi") && languageLower === "hi") score += 4
  if (name.includes("kannada") && languageLower === "kn") score += 4
  if (name.includes("tamil") && languageLower === "ta") score += 4
  if (name.includes("telugu") && languageLower === "te") score += 4

  if (voice?.localService) score += 1
  if (voice?.default) score += 0.5

  return score
}

function pickBrowserVoice(voices, language) {
  if (!Array.isArray(voices) || voices.length === 0) return null
  const locale = resolveLocale(language)
  let best = null
  let bestScore = -1

  voices.forEach((voice) => {
    const score = scoreBrowserVoice(voice, locale, language)
    if (score > bestScore) {
      bestScore = score
      best = voice
    }
  })

  if (bestScore > 0) return best
  return voices.find((voice) => voice.default) || voices[0]
}

function pickFallbackVoice(voices) {
  if (!Array.isArray(voices) || !voices.length) return null
  const preferred = ["en-IN", "hi-IN", "ta-IN", "en-GB", "en-US"]
  for (const lang of preferred) {
    const match = voices.find(
      (voice) => String(voice?.lang || "").toLowerCase() === lang.toLowerCase()
    )
    if (match) return match
  }
  return voices.find((voice) => voice.default) || voices[0]
}

function speakWithBrowser(text, language, voices, preferredVoiceUri) {
  if (!window.speechSynthesis || !text) return false

  const availableVoices = Array.isArray(voices)
    ? voices
    : window.speechSynthesis.getVoices()
  const preferredVoice =
    preferredVoiceUri && preferredVoiceUri !== "auto"
      ? availableVoices.find((voice) => voice.voiceURI === preferredVoiceUri)
      : null
  const selectedVoice = preferredVoice || pickBrowserVoice(availableVoices, language)
  const utterance = new SpeechSynthesisUtterance(text)
  if (selectedVoice) {
    utterance.voice = selectedVoice
    utterance.lang = selectedVoice.lang || resolveLocale(language)
  } else {
    utterance.lang = resolveLocale(language)
  }
  utterance.rate = BROWSER_SPEECH_RATE
  utterance.pitch = BROWSER_SPEECH_PITCH

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

function speakWithBrowserFallback(text, language, voices, preferredVoiceUri) {
  if (!window.speechSynthesis || !text) return false
  const availableVoices = Array.isArray(voices)
    ? voices
    : window.speechSynthesis.getVoices()
  const preferredVoice =
    preferredVoiceUri && preferredVoiceUri !== "auto"
      ? availableVoices.find((voice) => voice.voiceURI === preferredVoiceUri)
      : null
  const selectedVoice =
    preferredVoice ||
    pickBrowserVoice(availableVoices, language) ||
    pickFallbackVoice(availableVoices)

  const utterance = new SpeechSynthesisUtterance(text)
  if (selectedVoice) {
    utterance.voice = selectedVoice
    utterance.lang = selectedVoice.lang || resolveLocale(language)
  } else {
    utterance.lang = resolveLocale(language)
  }
  utterance.rate = BROWSER_SPEECH_RATE
  utterance.pitch = BROWSER_SPEECH_PITCH

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function cleanDisplayText(text) {
  if (!text) return ""
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/(^|\n)\s*\d+[.)]\s+/g, " ")
    .replace(/(^|\n)\s*[-•]\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasLanguageVoice(voices, language) {
  if (!Array.isArray(voices) || !voices.length) return false
  const locale = String(resolveLocale(language)).toLowerCase()
  const lang = String(language || "").toLowerCase()
  return voices.some((voice) => {
    const voiceLang = String(voice?.lang || "").toLowerCase()
    const name = String(voice?.name || "").toLowerCase()
    if (voiceLang === locale) return true
    if (voiceLang.startsWith(`${lang}-`)) return true
    if (voiceLang.startsWith(lang)) return true
    if (lang === "hi" && name.includes("hindi")) return true
    if (lang === "kn" && name.includes("kannada")) return true
    if (lang === "ta" && name.includes("tamil")) return true
    if (lang === "te" && name.includes("telugu")) return true
    if (lang === "en" && (name.includes("india") || name.includes("indian"))) return true
    return false
  })
}

function ChatWidget({ company, defaultLanguage }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! Ask me about Bhunidhi projects, pricing, or availability."
    }
  ])
  const [input, setInput] = useState("")
  const [language, setLanguage] = useState(defaultLanguage || "en")
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    budget: "",
    siteId: "",
    preferredTime: ""
  })

  const recognitionRef = useRef(null)
  const listRef = useRef(null)
  const [browserVoices, setBrowserVoices] = useState([])
  const [browserVoice, setBrowserVoice] = useState("auto")
  const [voicesReady, setVoicesReady] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState("")
  const pendingSpeechRef = useRef(null)
  const voiceRetryRef = useRef(0)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (defaultLanguage) {
      setLanguage(defaultLanguage)
    }
  }, [defaultLanguage])

  useEffect(() => {
    if (!window.speechSynthesis) return

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length) {
        setBrowserVoices(voices)
        setVoicesReady(true)
        const pending = pendingSpeechRef.current
        if (pending) {
          pendingSpeechRef.current = null
          speakWithBrowserFallback(pending.text, pending.language, voices, browserVoice)
        }
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  useEffect(() => {
    if (!window.speechSynthesis) return
    if (voicesReady) return

    const intervalId = setInterval(() => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length) {
        setBrowserVoices(voices)
        setVoicesReady(true)
        setVoiceStatus("")
        clearInterval(intervalId)
        return
      }
      voiceRetryRef.current += 1
      if (voiceRetryRef.current >= 10) {
        setVoiceStatus("No voices are available yet. Please restart Chrome.")
        clearInterval(intervalId)
      }
    }, 500)

    return () => clearInterval(intervalId)
  }, [voicesReady])

  useEffect(() => {
    if (!browserVoices.length) return
    const best = pickBrowserVoice(browserVoices, language)
    if (best && best.voiceURI && best.voiceURI !== browserVoice) {
      setBrowserVoice(best.voiceURI)
    }
  }, [language, browserVoices, browserVoice])

  async function speakReply(text, responseLanguage) {
    if (!voiceEnabled || !text) return
    const lang = responseLanguage || language

    if (!window.speechSynthesis) {
      setVoiceStatus("Speech output is not supported in this browser.")
      return
    }

    if (!voicesReady) {
      pendingSpeechRef.current = { text, language: lang }
      setVoiceStatus("Loading voices for speech output.")
      window.speechSynthesis.getVoices()
      return
    }

    setVoiceStatus("")
    speakWithBrowserFallback(text, lang, browserVoices, browserVoice)
  }

  function refreshVoices() {
    if (!window.speechSynthesis) {
      setVoiceStatus("Speech output is not supported in this browser.")
      return
    }
    const voices = window.speechSynthesis.getVoices()
    if (voices.length) {
      setBrowserVoices(voices)
      setVoicesReady(true)
      setVoiceStatus("")
    } else {
      setVoiceStatus("No voices are available yet. Please restart Chrome.")
    }
  }

  function testVoice() {
    const sample = SAMPLE_TEXT[language] || SAMPLE_TEXT.en
    speakWithBrowserFallback(sample, language, browserVoices, browserVoice)
  }

  async function handleSend(textOverride) {
    const text = (textOverride ?? input).trim()
    if (!text || isSending) return

    const nextMessages = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setInput("")
    setIsSending(true)

    try {
      const response = await sendMessage({
        message: text,
        language,
        history: nextMessages.map((item) => ({
          role: item.role,
          content: item.content
        }))
      })

      const reply = cleanDisplayText(
        response.reply || "Thanks! A team member will follow up shortly."
      )
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])

      if (response.lead_request) {
        setLeadForm((prev) => ({
          ...prev,
          ...response.lead
        }))
      }

      if (response.lead?.phone || response.lead?.email) {
        try {
          await createLead({
            ...response.lead,
            message: text,
            language: response.language || language
          })
        } catch (err) {
          // Ignore lead save errors to avoid interrupting the chat flow.
        }
      }

      await speakReply(reply, response.language || language)
    } catch (err) {
      const fallbackText = cleanDisplayText(FALLBACK_REPLY[language] || FALLBACK_REPLY.en)
      setMessages((prev) => [...prev, { role: "assistant", content: fallbackText }])
      await speakReply(fallbackText, language)
    } finally {
      setIsSending(false)
    }
  }

  function startBrowserRecognition() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return false

    try {
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.lang = resolveLocale(language)
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        const result = event.results?.[0]?.[0]?.transcript || ""
        if (result) {
          handleSend(result)
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "I could not hear that clearly. Please try again." }
          ])
        }
      }

      recognition.onerror = (event) => {
        const error = event?.error || "unknown"
        const messageMap = {
          "no-speech": "I could not hear anything. Please try again.",
          "audio-capture": "Microphone is not available.",
          "not-allowed": "Microphone access was denied.",
          "network": "Speech recognition failed. Please try again."
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: messageMap[error] || "Speech recognition failed." }
        ])
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
        recognitionRef.current = null
      }

      recognition.start()
      setIsRecording(true)
      return true
    } catch (err) {
      return false
    }
  }

  async function startRecording() {
    if (isRecording) return
    const started = startBrowserRecognition()
    if (!started) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Browser speech recognition is not available." }
      ])
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsRecording(false)
  }

  async function submitLead(event) {
    event.preventDefault()
    try {
      await createLead({
        ...leadForm,
        message: "Lead form submission",
        language
      })

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Thanks! Our team will call you shortly." }
      ])
      setLeadForm({
        name: "",
        phone: "",
        email: "",
        budget: "",
        siteId: "",
        preferredTime: ""
      })
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to save your details right now." }
      ])
    }
  }

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div>
          <h3>AI Assistant</h3>
          <p className="muted">Instant answers and lead follow-up.</p>
        </div>
        <div className="chat-controls">
          <select
            className="select small"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <select
            className="select small"
            value={browserVoice}
            onChange={(event) => setBrowserVoice(event.target.value)}
          >
            <option value="auto">Auto (Best match)</option>
            {browserVoices.map((item) => (
              <option key={item.voiceURI} value={item.voiceURI}>
                {item.name} ({item.lang})
              </option>
            ))}
          </select>
          <button className="secondary" type="button" onClick={refreshVoices}>
            Refresh voices
          </button>
          <button className="secondary" type="button" onClick={testVoice}>
            Test voice
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(event) => setVoiceEnabled(event.target.checked)}
            />
            Voice reply
          </label>
        </div>
        {voiceStatus && <p className="muted small">{voiceStatus}</p>}
      </div>

      <div className="messages" ref={listRef}>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`bubble ${message.role === "user" ? "user" : "assistant"}`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about plots, pricing, or visits..."
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSend()
            }
          }}
        />
        <button className="secondary" onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? "Stop" : "Mic"}
        </button>
        <button className="primary" onClick={() => handleSend()}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
      <form className="lead-form" onSubmit={submitLead}>
        <h4>Request a Call</h4>
        <input
          placeholder="Name"
          value={leadForm.name}
          onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })}
        />
        <input
          placeholder="Phone"
          value={leadForm.phone}
          onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })}
        />
        <input
          placeholder="Email"
          value={leadForm.email}
          onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })}
        />
        <div className="lead-row">
          <input
            placeholder="Budget"
            value={leadForm.budget}
            onChange={(event) => setLeadForm({ ...leadForm, budget: event.target.value })}
          />
          <input
            placeholder="Site ID"
            value={leadForm.siteId}
            onChange={(event) => setLeadForm({ ...leadForm, siteId: event.target.value })}
          />
        </div>
        <input
          placeholder="Preferred time to call"
          value={leadForm.preferredTime}
          onChange={(event) => setLeadForm({ ...leadForm, preferredTime: event.target.value })}
        />
        <button className="primary" type="submit">
          Submit
        </button>
        <p className="muted small">
          Or call {company?.phone || "our sales team"} for immediate assistance.
        </p>
      </form>
    </div>
  )
}

export default ChatWidget
