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
  createHabitUsage,
  findHabitUsage,
  deleteHabitUsage,
  listHabitMethodIdsForDate
} from "../habit-usage-repo.js"

const mockDbQuery = vi.mocked(dbQuery)
const mockWithDbTransaction = vi.mocked(withDbTransaction)

const fakeRow = {
  id: "uuid-1",
  user_id: "rec123",
  method_id: "recMethod1",
  usage_date: "2025-06-15"
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createHabitUsage", () => {
  it("inserts via transaction and returns mapped row", async () => {
    // withDbTransaction calls fn(mockClient), so we need mockClient.query to return data
    mockWithDbTransaction.mockImplementationOnce(async (fn) => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 })
      }
      return fn(mockClient as any)
    })

    const result = await createHabitUsage({
      userId: "rec123",
      methodId: "recMethod1",
      date: "2025-06-15"
    })

    expect(result.id).toBe("uuid-1")
    expect(result.userId).toBe("rec123")
    expect(result.methodId).toBe("recMethod1")
    expect(result.usageDate).toBe("2025-06-15")
  })
})

describe("findHabitUsage", () => {
  it("returns mapped row when found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await findHabitUsage("rec123", "recMethod1", "2025-06-15")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("uuid-1")
    expect(result!.userId).toBe("rec123")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND method_id = $2 AND usage_date = $3"),
      ["rec123", "recMethod1", "2025-06-15"]
    )
  })

  it("returns null when not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const result = await findHabitUsage("rec123", "recMethod1", "2025-06-15")
    expect(result).toBeNull()
  })
})

describe("deleteHabitUsage", () => {
  it("calls DELETE with correct params", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await deleteHabitUsage("rec123", "recMethod1", "2025-06-15")

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM habit_usage_pg"),
      ["rec123", "recMethod1", "2025-06-15"]
    )
  })
})

describe("listHabitMethodIdsForDate", () => {
  it("returns array of method_id strings", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ method_id: "recA" }, { method_id: "recB" }],
      rowCount: 2,
      command: "",
      oid: 0,
      fields: []
    })

    const ids = await listHabitMethodIdsForDate("rec123", "2025-06-15")
    expect(ids).toEqual(["recA", "recB"])
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT method_id"),
      ["rec123", "2025-06-15"]
    )
  })
})
