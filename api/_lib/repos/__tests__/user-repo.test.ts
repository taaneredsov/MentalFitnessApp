// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../db/client.js", () => ({
  dbQuery: vi.fn()
}))

import { dbQuery } from "../../db/client.js"
import {
  findUserById,
  findUserByEmail,
  upsertUserFromAirtable,
  updateUserStreakFields,
  incrementUserBonusPoints,
  getUserRewardsData
} from "../user-repo.js"

const mockDbQuery = vi.mocked(dbQuery)

const fakeUserRow = {
  id: "rec123",
  name: "Test User",
  email: "test@example.com",
  role: "user",
  language_code: "nl",
  password_hash: "hash123",
  last_login: "2025-06-01",
  current_streak: 3,
  longest_streak: 7,
  last_active_date: "2025-06-15",
  bonus_points: 50,
  badges: "[]",
  level: 2,
  created_at: "2025-01-01",
  updated_at: "2025-06-15"
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("findUserById", () => {
  it("returns mapped user when found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeUserRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const user = await findUserById("rec123")
    expect(user).not.toBeNull()
    expect(user!.id).toBe("rec123")
    expect(user!.name).toBe("Test User")
    expect(user!.email).toBe("test@example.com")
    expect(user!.currentStreak).toBe(3)
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["rec123"]
    )
  })

  it("returns null when not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const user = await findUserById("nonexistent")
    expect(user).toBeNull()
  })
})

describe("findUserByEmail", () => {
  it("returns mapped user when found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeUserRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const user = await findUserByEmail("test@example.com")
    expect(user).not.toBeNull()
    expect(user!.email).toBe("test@example.com")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(email) = LOWER($1)"),
      ["test@example.com"]
    )
  })

  it("returns null when not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const user = await findUserByEmail("noone@example.com")
    expect(user).toBeNull()
  })
})

describe("upsertUserFromAirtable", () => {
  it("calls INSERT ON CONFLICT with correct params", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeUserRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await upsertUserFromAirtable({
      id: "rec123",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      languageCode: "nl"
    })

    expect(result.id).toBe("rec123")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (id)"),
      expect.arrayContaining(["rec123", "Test User", "test@example.com"])
    )
  })
})

describe("updateUserStreakFields", () => {
  it("calls UPDATE with correct params", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await updateUserStreakFields({
      userId: "rec123",
      currentStreak: 5,
      longestStreak: 10,
      lastActiveDate: "2025-06-15"
    })

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("current_streak = $2"),
      ["rec123", 5, 10, "2025-06-15"]
    )
  })
})

describe("incrementUserBonusPoints", () => {
  it("calls UPDATE with correct increment", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await incrementUserBonusPoints("rec123", 25)

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("bonus_points = COALESCE(bonus_points, 0) + $2"),
      ["rec123", 25]
    )
  })
})

describe("getUserRewardsData", () => {
  it("returns user with counts when user exists", async () => {
    // First call: findUserById
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeUserRow], rowCount: 1, command: "", oid: 0, fields: [] })
    // Next 6 calls: COUNT queries for habits, methods, goals, overtuigingen, habit days, programs completed
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1, command: "", oid: 0, fields: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "10" }], rowCount: 1, command: "", oid: 0, fields: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "3" }], rowCount: 1, command: "", oid: 0, fields: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "2" }], rowCount: 1, command: "", oid: 0, fields: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "4" }], rowCount: 1, command: "", oid: 0, fields: [] })
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "1" }], rowCount: 1, command: "", oid: 0, fields: [] })

    const data = await getUserRewardsData("rec123")
    expect(data).not.toBeNull()
    expect(data!.user.id).toBe("rec123")
    expect(data!.habitCount).toBe(5)
    expect(data!.methodCount).toBe(10)
    expect(data!.personalGoalCount).toBe(3)
    expect(data!.overtuigingCount).toBe(2)
  })

  it("returns null when user not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const data = await getUserRewardsData("nonexistent")
    expect(data).toBeNull()
  })
})
