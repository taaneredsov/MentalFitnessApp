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
  createOvertuigingUsage,
  findOvertuigingUsage,
  listOvertuigingUsageByUser,
  listOvertuigingUsageByUserAndProgram
} from "../overtuiging-usage-repo.js"

const mockDbQuery = vi.mocked(dbQuery)
const mockWithDbTransaction = vi.mocked(withDbTransaction)

const fakeRow = {
  id: "uuid-1",
  user_id: "rec123",
  overtuiging_id: "recOv1",
  program_id: "recProg1",
  usage_date: "2025-06-15"
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createOvertuigingUsage", () => {
  it("inserts successfully and returns mapped row", async () => {
    mockWithDbTransaction.mockImplementationOnce(async (fn) => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 })
      }
      return fn(mockClient as any)
    })

    const result = await createOvertuigingUsage({
      userId: "rec123",
      overtuigingId: "recOv1",
      programId: "recProg1",
      date: "2025-06-15"
    })

    expect(result.id).toBe("uuid-1")
    expect(result.overtuigingId).toBe("recOv1")
  })

  it("throws when ON CONFLICT DO NOTHING results in rowCount=0", async () => {
    mockWithDbTransaction.mockImplementationOnce(async (fn) => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 })
      }
      return fn(mockClient as any)
    })

    await expect(
      createOvertuigingUsage({
        userId: "rec123",
        overtuigingId: "recOv1",
        date: "2025-06-15"
      })
    ).rejects.toThrow("Overtuiging already completed")
  })
})

describe("findOvertuigingUsage", () => {
  it("returns mapped row when found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await findOvertuigingUsage("rec123", "recOv1")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("uuid-1")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND overtuiging_id = $2"),
      ["rec123", "recOv1"]
    )
  })

  it("returns null when not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const result = await findOvertuigingUsage("rec123", "recOv1")
    expect(result).toBeNull()
  })
})

describe("listOvertuigingUsageByUser", () => {
  it("returns Record map of completed overtuigingen", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ overtuiging_id: "recOv1" }, { overtuiging_id: "recOv2" }],
      rowCount: 2,
      command: "",
      oid: 0,
      fields: []
    })

    const result = await listOvertuigingUsageByUser("rec123")
    expect(result).toEqual({
      recOv1: { completed: true },
      recOv2: { completed: true }
    })
  })
})

describe("listOvertuigingUsageByUserAndProgram", () => {
  it("returns Record map and query includes OR program_id IS NULL", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ overtuiging_id: "recOv1" }],
      rowCount: 1,
      command: "",
      oid: 0,
      fields: []
    })

    const result = await listOvertuigingUsageByUserAndProgram("rec123", "recProg1")
    expect(result).toEqual({ recOv1: { completed: true } })
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("program_id IS NULL"),
      ["rec123", "recProg1"]
    )
  })
})
