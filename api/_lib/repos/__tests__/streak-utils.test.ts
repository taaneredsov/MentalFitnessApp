// @vitest-environment node
import { describe, it, expect } from "vitest"
import { calculateNextStreak } from "../streak-utils.js"

describe("calculateNextStreak", () => {
  it("returns same values when lastActiveDate equals today", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-06-15",
      currentStreak: 5,
      longestStreak: 10,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 5, longestStreak: 10 })
  })

  it("increments current streak for consecutive day (diff=1)", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-06-14",
      currentStreak: 3,
      longestStreak: 10,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 4, longestStreak: 10 })
  })

  it("resets current streak to 1 when gap > 1 day", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-06-10",
      currentStreak: 7,
      longestStreak: 10,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 1, longestStreak: 10 })
  })

  it("starts at 1 when lastActiveDate is null", () => {
    const result = calculateNextStreak({
      lastActiveDate: null,
      currentStreak: 0,
      longestStreak: 0,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 })
  })

  it("updates longest streak when current exceeds it", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-06-14",
      currentStreak: 10,
      longestStreak: 10,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 11, longestStreak: 11 })
  })

  it("handles year boundary (Dec 31 -> Jan 1)", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-12-31",
      currentStreak: 5,
      longestStreak: 5,
      today: "2026-01-01"
    })
    expect(result).toEqual({ currentStreak: 6, longestStreak: 6 })
  })

  it("handles month boundary (Jan 31 -> Feb 1)", () => {
    const result = calculateNextStreak({
      lastActiveDate: "2025-01-31",
      currentStreak: 2,
      longestStreak: 8,
      today: "2025-02-01"
    })
    expect(result).toEqual({ currentStreak: 3, longestStreak: 8 })
  })

  it("does not update longest streak when current does not exceed it", () => {
    const result = calculateNextStreak({
      lastActiveDate: null,
      currentStreak: 0,
      longestStreak: 5,
      today: "2025-06-15"
    })
    expect(result).toEqual({ currentStreak: 1, longestStreak: 5 })
  })
})
