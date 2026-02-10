function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map((v) => Number(v))
  return {
    year: y,
    month: m,
    day: d
  }
}

function parseTimeParts(timeStr: string): { hour: number; minute: number; second: number } {
  const [h, m, s] = timeStr.split(":")
  return {
    hour: Number(h || 0),
    minute: Number(m || 0),
    second: Number(s || 0)
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })

  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    map[part.type] = part.value
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return asUtc - date.getTime()
}

export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const date = parseDateParts(dateStr)
  const time = parseTimeParts(timeStr)
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offset)
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
  return dtf.format(date)
}

export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
  return dtf.format(date)
}

function minutesFromTime(timeStr: string): number {
  const { hour, minute } = parseTimeParts(timeStr)
  return (hour * 60) + minute
}

export function isTimeInsideQuietHours(timeStr: string, quietStart: string, quietEnd: string): boolean {
  const value = minutesFromTime(timeStr)
  const start = minutesFromTime(quietStart)
  const end = minutesFromTime(quietEnd)

  if (start === end) {
    return true
  }

  if (start < end) {
    return value >= start && value < end
  }

  return value >= start || value < end
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + (minutes * 60 * 1000))
}
