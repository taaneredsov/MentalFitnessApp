function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function getTodayLocalDate(): string {
  return formatLocalDate(new Date())
}

export function normalizeDateString(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const isoDay = trimmed.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    return isoDay
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return formatLocalDate(parsed)
}

function parseIsoDay(day: string): { year: number; month: number; date: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(date)) return null
  return { year, month, date }
}

function dayOrdinal(isoDay: string): number | null {
  const parsed = parseIsoDay(isoDay)
  if (!parsed) return null
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.date) / 86400000)
}

export function diffIsoDays(fromIsoDay: string, toIsoDay: string): number | null {
  const fromOrd = dayOrdinal(fromIsoDay)
  const toOrd = dayOrdinal(toIsoDay)
  if (fromOrd === null || toOrd === null) return null
  return toOrd - fromOrd
}
