type TranslationMap = Record<string, string>

const ATTRIBUTES_TO_TRANSLATE = ["placeholder", "title", "aria-label", "aria-description"] as const
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"])

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function hasLetters(value: string): boolean {
  return /\p{L}/u.test(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

class DomCopyTranslator {
  private observer: MutationObserver | null = null
  private rafId: number | null = null
  private normalizedMap = new Map<string, string>()
  private exactMap = new Map<string, string>()
  private multiwordPhrases: Array<{ from: string; to: string }> = []
  private originalTextNodes = new WeakMap<Text, string>()
  private originalAttributes = new WeakMap<Element, Map<string, string>>()

  setTranslations(map: TranslationMap): void {
    this.exactMap = new Map(Object.entries(map))
    this.normalizedMap = new Map(
      Object.entries(map).map(([key, value]) => [normalizeText(key), value]),
    )
    this.multiwordPhrases = Object.entries(map)
      .filter(([key, value]) => key !== value && key.includes(" ") && key.length >= 6)
      .sort((a, b) => b[0].length - a[0].length)
      .map(([from, to]) => ({ from, to }))

    this.scheduleApply()
  }

  start(): void {
    if (typeof window === "undefined" || this.observer) return

    this.applyToSubtree(document.body)

    this.observer = new MutationObserver(() => {
      this.scheduleApply()
    })

    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES_TO_TRANSLATE]
    })
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private scheduleApply(): void {
    if (typeof window === "undefined") return
    if (this.rafId !== null) return
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null
      this.applyToSubtree(document.body)
    })
  }

  private translateRaw(raw: string): string {
    if (!raw || !hasLetters(raw)) return raw

    const exact = this.exactMap.get(raw)
    if (exact) return exact

    const normalized = normalizeText(raw)
    const normalizedHit = this.normalizedMap.get(normalized)
    if (normalizedHit) {
      const leading = raw.match(/^\s*/)?.[0] || ""
      const trailing = raw.match(/\s*$/)?.[0] || ""
      return `${leading}${normalizedHit}${trailing}`
    }

    let translated = raw
    for (const { from, to } of this.multiwordPhrases) {
      if (!translated.includes(from)) continue
      translated = translated.replace(new RegExp(escapeRegExp(from), "g"), to)
    }

    return translated
  }

  private shouldSkipTextNode(node: Text): boolean {
    const parent = node.parentElement
    if (!parent) return true
    if (SKIP_TAGS.has(parent.tagName)) return true
    if (parent.closest("[data-no-i18n]")) return true
    return false
  }

  private translateTextNode(node: Text): void {
    if (this.shouldSkipTextNode(node)) return

    if (!this.originalTextNodes.has(node)) {
      this.originalTextNodes.set(node, node.nodeValue || "")
    }

    const original = this.originalTextNodes.get(node) || ""
    const translated = this.translateRaw(original)
    if (node.nodeValue !== translated) {
      node.nodeValue = translated
    }
  }

  private translateAttributes(element: Element): void {
    let originals = this.originalAttributes.get(element)
    if (!originals) {
      originals = new Map<string, string>()
      this.originalAttributes.set(element, originals)
    }

    for (const attr of ATTRIBUTES_TO_TRANSLATE) {
      const current = element.getAttribute(attr)
      if (current == null) continue

      if (!originals.has(attr)) {
        originals.set(attr, current)
      }

      const original = originals.get(attr) || current
      const translated = this.translateRaw(original)
      if (translated !== current) {
        element.setAttribute(attr, translated)
      }
    }
  }

  private applyToSubtree(root: Element | null): void {
    if (!root) return

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      this.translateTextNode(node as Text)
      node = walker.nextNode()
    }

    const elements = root.querySelectorAll("*")
    for (const el of elements) {
      this.translateAttributes(el)
    }
    this.translateAttributes(root)
  }
}

export const domCopyTranslator = new DomCopyTranslator()
