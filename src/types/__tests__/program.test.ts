import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getProgramStatus,
  getNextScheduledDay,
  formatNextDay,
  parseWeeksFromDuration,
  getActivityProgress,
  getSessionProgress,
  type Program,
  type ProgramDetail,
} from "../program"

describe("getProgramStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "planned" for future programs', () => {
    vi.setSystemTime(new Date("2024-01-01"))

    const program: Program = {
      id: "rec123",
      startDate: "2024-06-01",
      endDate: "2024-08-01",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getProgramStatus(program)).toBe("planned")
  })

  it('returns "running" for current programs', () => {
    vi.setSystemTime(new Date("2024-07-15"))

    const program: Program = {
      id: "rec456",
      startDate: "2024-06-01",
      endDate: "2024-08-01",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getProgramStatus(program)).toBe("running")
  })

  it('returns "finished" for past programs', () => {
    vi.setSystemTime(new Date("2024-12-01"))

    const program: Program = {
      id: "rec789",
      startDate: "2024-06-01",
      endDate: "2024-08-01",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getProgramStatus(program)).toBe("finished")
  })

  it('returns "running" on start date', () => {
    vi.setSystemTime(new Date("2024-06-01"))

    const program: Program = {
      id: "recStart",
      startDate: "2024-06-01",
      endDate: "2024-08-01",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getProgramStatus(program)).toBe("running")
  })

  it('returns "running" on end date', () => {
    vi.setSystemTime(new Date("2024-08-01"))

    const program: Program = {
      id: "recEnd",
      startDate: "2024-06-01",
      endDate: "2024-08-01",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getProgramStatus(program)).toBe("running")
  })
})

describe("getNextScheduledDay", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns null for empty day list", () => {
    const result = getNextScheduledDay([])

    expect(result).toBeNull()
  })

  it("returns today when current day is in schedule", () => {
    // Set to Monday (day 1)
    vi.setSystemTime(new Date("2024-06-03")) // Monday

    const result = getNextScheduledDay(["Maandag", "Woensdag", "Vrijdag"])

    expect(result).toEqual({
      day: "Maandag",
      isToday: true,
      daysUntil: 0,
    })
  })

  it("returns next scheduled day when today is not in schedule", () => {
    // Set to Tuesday (day 2)
    vi.setSystemTime(new Date("2024-06-04")) // Tuesday

    const result = getNextScheduledDay(["Maandag", "Woensdag", "Vrijdag"])

    expect(result).toEqual({
      day: "Woensdag",
      isToday: false,
      daysUntil: 1,
    })
  })

  it("wraps around to next week if needed", () => {
    // Set to Saturday (day 6)
    vi.setSystemTime(new Date("2024-06-08")) // Saturday

    const result = getNextScheduledDay(["Maandag", "Woensdag"])

    expect(result).toEqual({
      day: "Maandag",
      isToday: false,
      daysUntil: 2,
    })
  })

  it("handles Sunday schedule", () => {
    // Set to Sunday (day 0)
    vi.setSystemTime(new Date("2024-06-09")) // Sunday

    const result = getNextScheduledDay(["Zondag"])

    expect(result).toEqual({
      day: "Zondag",
      isToday: true,
      daysUntil: 0,
    })
  })

  it("finds closest future day", () => {
    // Set to Wednesday (day 3)
    vi.setSystemTime(new Date("2024-06-05")) // Wednesday

    const result = getNextScheduledDay(["Maandag", "Vrijdag"])

    expect(result).toEqual({
      day: "Vrijdag",
      isToday: false,
      daysUntil: 2,
    })
  })
})

describe("formatNextDay", () => {
  it('returns "Vandaag" for today', () => {
    const result = formatNextDay({
      day: "Maandag",
      isToday: true,
      daysUntil: 0,
    })

    expect(result).toBe("Vandaag")
  })

  it('returns "Morgen" for tomorrow', () => {
    const result = formatNextDay({
      day: "Dinsdag",
      isToday: false,
      daysUntil: 1,
    })

    expect(result).toBe("Morgen")
  })

  it("returns day name for days further in the future", () => {
    const result = formatNextDay({
      day: "Vrijdag",
      isToday: false,
      daysUntil: 3,
    })

    expect(result).toBe("Vrijdag")
  })
})

describe("parseWeeksFromDuration", () => {
  it('parses "4 weken"', () => {
    expect(parseWeeksFromDuration("4 weken")).toBe(4)
  })

  it('parses "8 weken"', () => {
    expect(parseWeeksFromDuration("8 weken")).toBe(8)
  })

  it('parses "12 weken"', () => {
    expect(parseWeeksFromDuration("12 weken")).toBe(12)
  })

  it("parses single digit", () => {
    expect(parseWeeksFromDuration("2 weken")).toBe(2)
  })

  it("returns 0 for invalid format", () => {
    expect(parseWeeksFromDuration("invalid")).toBe(0)
  })

  it("returns 0 for empty string", () => {
    expect(parseWeeksFromDuration("")).toBe(0)
  })

  it("extracts number from complex string", () => {
    expect(parseWeeksFromDuration("6 weken programma")).toBe(6)
  })
})

describe("getActivityProgress", () => {
  it("calculates progress percentage correctly", () => {
    const program: Program = {
      id: "rec123",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
      methodUsageCount: 12, // 12 completed out of 8*3=24 expected
    }

    expect(getActivityProgress(program)).toBe(50)
  })

  it("returns 0 when no sessions expected", () => {
    const program: Program = {
      id: "rec456",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "0 weken",
      daysOfWeek: [],
      frequency: 0,
      goals: [],
      methods: [],
    }

    expect(getActivityProgress(program)).toBe(0)
  })

  it("returns 0 when frequency is 0", () => {
    const program: Program = {
      id: "rec789",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 0,
      goals: [],
      methods: [],
      methodUsageCount: 5,
    }

    expect(getActivityProgress(program)).toBe(0)
  })

  it("caps at 100%", () => {
    const program: Program = {
      id: "recCapped",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "4 weken",
      daysOfWeek: [],
      frequency: 2,
      goals: [],
      methods: [],
      methodUsageCount: 50, // Way more than expected 4*2=8
    }

    expect(getActivityProgress(program)).toBe(100)
  })

  it("handles missing methodUsageCount", () => {
    const program: Program = {
      id: "recNoUsage",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
    }

    expect(getActivityProgress(program)).toBe(0)
  })
})

describe("getSessionProgress", () => {
  it("calculates progress percentage correctly", () => {
    const programDetail: ProgramDetail = {
      id: "rec123",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "8 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
      goalDetails: [],
      methodDetails: [],
      dayNames: [],
      schedule: [],
      totalSessions: 24,
      completedSessions: 12,
      totalMethods: 24,
      completedMethods: 12,
      milestonesAwarded: [],
    }

    expect(getSessionProgress(programDetail)).toBe(50)
  })

  it("returns 0 when no sessions", () => {
    const programDetail: ProgramDetail = {
      id: "rec456",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "4 weken",
      daysOfWeek: [],
      frequency: 0,
      goals: [],
      methods: [],
      goalDetails: [],
      methodDetails: [],
      dayNames: [],
      schedule: [],
      totalSessions: 0,
      completedSessions: 0,
      totalMethods: 0,
      completedMethods: 0,
      milestonesAwarded: [],
    }

    expect(getSessionProgress(programDetail)).toBe(0)
  })

  it("caps at 100%", () => {
    const programDetail: ProgramDetail = {
      id: "recCapped",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "4 weken",
      daysOfWeek: [],
      frequency: 2,
      goals: [],
      methods: [],
      goalDetails: [],
      methodDetails: [],
      dayNames: [],
      schedule: [],
      totalSessions: 8,
      completedSessions: 10, // More than total
      totalMethods: 8,
      completedMethods: 10,
      milestonesAwarded: [],
    }

    expect(getSessionProgress(programDetail)).toBe(100)
  })

  it("rounds to nearest integer", () => {
    const programDetail: ProgramDetail = {
      id: "recRound",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "4 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
      goalDetails: [],
      methodDetails: [],
      dayNames: [],
      schedule: [],
      totalSessions: 10,
      completedSessions: 3, // 30%
      totalMethods: 10,
      completedMethods: 3,
      milestonesAwarded: [],
    }

    expect(getSessionProgress(programDetail)).toBe(30)
  })

  it("handles partial completion", () => {
    const programDetail: ProgramDetail = {
      id: "recPartial",
      startDate: "2024-01-01",
      endDate: "2024-02-26",
      duration: "6 weken",
      daysOfWeek: [],
      frequency: 3,
      goals: [],
      methods: [],
      goalDetails: [],
      methodDetails: [],
      dayNames: [],
      schedule: [],
      totalSessions: 18,
      completedSessions: 7,
      totalMethods: 18,
      completedMethods: 7,
      milestonesAwarded: [],
    }

    // 7/18 * 100 = 38.89 -> rounded to 39
    expect(getSessionProgress(programDetail)).toBe(39)
  })
})
