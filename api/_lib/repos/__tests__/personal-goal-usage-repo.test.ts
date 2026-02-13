// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../db/client.js", () => ({
  dbQuery: vi.fn(),
  withDbTransaction: vi.fn(async (fn) => {
    const mockClient = { query: vi.fn() }
    return fn(mockClient)
  })
}))

import { dbQuery, withDbTransaction } from "../../db/client.js"
import {
  listPersonalGoalCountsByUserDate,
  personalGoalBelongsToUser,
  upsertPersonalGoal,
  createPersonalGoalUsage,
  countGoalUsageForUserGoalDate
} from "../personal-goal-usage-repo.js"

const mockDbQuery = vi.mocked(dbQuery)
const mockWithDbTransaction = vi.mocked(withDbTransaction)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("listPersonalGoalCountsByUserDate", () => {
  it("returns aggregated counts by goal id", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        { personal_goal_id: "goal-1", total_count: 5, today_count: 2 },
        { personal_goal_id: "goal-2", total_count: 3, today_count: 0 }
      ],
      rowCount: 2,
      command: "",
      oid: 0,
      fields: []
    })

    const result = await listPersonalGoalCountsByUserDate("rec123", "2025-06-15")
    expect(result).toEqual({
      "goal-1": { today: 2, total: 5 },
      "goal-2": { today: 0, total: 3 }
    })
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("GROUP BY personal_goal_id"),
      ["rec123", "2025-06-15"]
    )
  })
})

describe("personalGoalBelongsToUser", () => {
  it("returns true when goal belongs to user", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ id: "goal-1" }],
      rowCount: 1,
      command: "",
      oid: 0,
      fields: []
    })

    const result = await personalGoalBelongsToUser("goal-1", "rec123")
    expect(result).toBe(true)
  })

  it("returns false when goal does not belong to user", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const result = await personalGoalBelongsToUser("goal-1", "rec456")
    expect(result).toBe(false)
  })
})

describe("upsertPersonalGoal", () => {
  it("calls INSERT ON CONFLICT with correct params", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await upsertPersonalGoal({
      id: "goal-1",
      userId: "rec123",
      name: "Exercise daily",
      description: "At least 30 min",
      active: true
    })

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (id)"),
      ["goal-1", "rec123", "Exercise daily", "At least 30 min", true]
    )
  })
})

describe("createPersonalGoalUsage", () => {
  it("inserts via transaction and returns id", async () => {
    mockWithDbTransaction.mockImplementationOnce(async (fn) => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ id: "usage-1" }], rowCount: 1 })
      }
      return fn(mockClient as unknown as import("pg").PoolClient)
    })

    const result = await createPersonalGoalUsage({
      userId: "rec123",
      personalGoalId: "goal-1",
      date: "2025-06-15"
    })

    expect(result).toEqual({ id: "usage-1" })
  })
})

describe("countGoalUsageForUserGoalDate", () => {
  it("returns today and total counts", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ total_count: 10, today_count: 3 }],
      rowCount: 1,
      command: "",
      oid: 0,
      fields: []
    })

    const result = await countGoalUsageForUserGoalDate("rec123", "goal-1", "2025-06-15")
    expect(result).toEqual({ todayCount: 3, totalCount: 10 })
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND personal_goal_id = $2"),
      ["rec123", "goal-1", "2025-06-15"]
    )
  })
})
