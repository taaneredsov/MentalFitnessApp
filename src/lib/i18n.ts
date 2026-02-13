import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import { fallbackTranslations } from "@/lib/i18n-fallback"
import { domCopyTranslator } from "@/lib/dom-copy-translator"

const SUPPORTED_LANGUAGES = ["nl", "fr", "en"] as const
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const BY_KEY_CACHE_PREFIX = "i18n_by_key"
const BY_NL_CACHE_PREFIX = "i18n_by_nl"
const CACHE_TS_PREFIX = "i18n_cache_ts"
const CACHE_MAX_AGE_MS = 5 * 60 * 1000

type TranslationPayload = {
  byKey: Record<string, string>
  byNl: Record<string, string>
}

const inFlightLoads = new Map<string, Promise<void>>()
const byNlStore: Record<string, Record<string, string>> = {}

function isSupportedLanguage(lang: unknown): lang is SupportedLanguage {
  return typeof lang === "string" && SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}

function normalizeLanguage(input: unknown): SupportedLanguage {
  if (typeof input !== "string") return "nl"
  const value = input.toLowerCase().split("-")[0]
  return isSupportedLanguage(value) ? value : "nl"
}

function getStorageKey(prefix: string, lang: string): string {
  return `${prefix}_${lang}`
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures.
  }
}

function getCachedPayload(lang: SupportedLanguage): TranslationPayload | null {
  try {
    const byKeyRaw = safeLocalStorageGet(getStorageKey(BY_KEY_CACHE_PREFIX, lang))
    const byNlRaw = safeLocalStorageGet(getStorageKey(BY_NL_CACHE_PREFIX, lang))
    if (!byKeyRaw) return null

    const byKey = JSON.parse(byKeyRaw) as Record<string, string>
    const byNl = byNlRaw ? (JSON.parse(byNlRaw) as Record<string, string>) : {}
    return { byKey, byNl }
  } catch {
    return null
  }
}

function setCachedPayload(lang: SupportedLanguage, payload: TranslationPayload): void {
  safeLocalStorageSet(getStorageKey(BY_KEY_CACHE_PREFIX, lang), JSON.stringify(payload.byKey))
  safeLocalStorageSet(getStorageKey(BY_NL_CACHE_PREFIX, lang), JSON.stringify(payload.byNl))
  safeLocalStorageSet(getStorageKey(CACHE_TS_PREFIX, lang), String(Date.now()))
}

function isCacheStale(lang: SupportedLanguage): boolean {
  const tsRaw = safeLocalStorageGet(getStorageKey(CACHE_TS_PREFIX, lang))
  if (!tsRaw) return true
  const ts = Number(tsRaw)
  if (!Number.isFinite(ts)) return true
  return Date.now() - ts > CACHE_MAX_AGE_MS
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "nl"
  const stored = safeLocalStorageGet("i18nextLng")
  if (isSupportedLanguage(stored)) return stored
  return normalizeLanguage(window.navigator.language)
}

function setHtmlLang(lang: SupportedLanguage): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = lang
}

async function fetchTranslations(lang: SupportedLanguage): Promise<TranslationPayload | null> {
  try {
    const res = await fetch(`/api/translations/${lang}?mode=full`)
    if (!res.ok) return null

    const json = await res.json() as {
      success?: boolean
      data?: {
        byKey?: Record<string, string>
        byNl?: Record<string, string>
      } | Record<string, string>
    }

    if (!json.success || !json.data) return null

    if ("byKey" in json.data || "byNl" in json.data) {
      const byKey = (json.data as { byKey?: Record<string, string> }).byKey || {}
      const byNl = (json.data as { byNl?: Record<string, string> }).byNl || {}
      return { byKey, byNl }
    }

    // Backward-compatible fallback if API returns only key-value map.
    return { byKey: json.data as Record<string, string>, byNl: {} }
  } catch {
    return null
  }
}

function applyDomTranslations(lang: SupportedLanguage): void {
  const map = lang === "nl" ? {} : (byNlStore[lang] || {})
  domCopyTranslator.setTranslations(map)
}

async function ensureLanguageResources(langInput: string, force = false): Promise<void> {
  const lang = normalizeLanguage(langInput)
  const inflightKey = `${lang}:${force ? "force" : "normal"}`
  const existing = inFlightLoads.get(inflightKey)
  if (existing) return existing

  const work = (async () => {
    const cached = getCachedPayload(lang)
    if (cached) {
      byNlStore[lang] = cached.byNl
      i18n.addResourceBundle(lang, "translation", cached.byKey, true, true)
      applyDomTranslations(lang)
      if (!force && !isCacheStale(lang)) return
    }

    const fetched = await fetchTranslations(lang)
    if (!fetched) return

    byNlStore[lang] = fetched.byNl
    setCachedPayload(lang, fetched)
    i18n.addResourceBundle(lang, "translation", fetched.byKey, true, true)
    applyDomTranslations(lang)
  })()

  inFlightLoads.set(inflightKey, work)
  try {
    await work
  } finally {
    inFlightLoads.delete(inflightKey)
  }
}

const initialLanguage = getInitialLanguage()
const cachedInitial = typeof window !== "undefined" ? getCachedPayload(initialLanguage) : null
const initialByKey = cachedInitial?.byKey || fallbackTranslations[initialLanguage] || fallbackTranslations.nl
byNlStore[initialLanguage] = cachedInitial?.byNl || {}

domCopyTranslator.start()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: "nl",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources: {
      [initialLanguage]: {
        translation: initialByKey
      }
    },
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"]
    },
    keySeparator: false,
    nsSeparator: false
  })

setHtmlLang(initialLanguage)
applyDomTranslations(initialLanguage)
void ensureLanguageResources(initialLanguage)

i18n.on("languageChanged", (next) => {
  const lang = normalizeLanguage(next)
  setHtmlLang(lang)
  void ensureLanguageResources(lang, true)
})

export async function syncLanguageWithUserPreference(languageCode?: string): Promise<void> {
  if (!languageCode) return
  const lang = normalizeLanguage(languageCode)
  const stored = safeLocalStorageGet("i18nextLng")
  if (isSupportedLanguage(stored)) return
  await i18n.changeLanguage(lang)
}

export default i18n
