const LANGUAGE_TO_LOCALE = {
  en: "en-IN",
  kn: "kn-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN"
}

function resolveLocale(language) {
  return LANGUAGE_TO_LOCALE[language] || language || "en-IN"
}

export { LANGUAGE_TO_LOCALE, resolveLocale }
