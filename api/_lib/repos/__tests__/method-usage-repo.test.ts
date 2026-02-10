// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../db/client.js", () => ({
  dbQuery: vi.fn(),
  withDbTransaction: vi.fn(async (fn) => {
    const mockClient = { query: vi.fn() }
    return fn(mockClient)
  })
}))

vi.mock("../../db/id-utils.js", () => ({
  isAirtableRecordId: vi.fn()
}))

import { dbQuery, withDbTransaction } from "../../db/client.js"
import { isAirtableRecordId } from "../../db/id-utils.js"
import {
  createMethodUsage,
  getMethodUsageById,
  getMethodUsageByAnyId,
  updateMethodUsageRemark,
  listLatestByProgram,
  toApiMethodUsage
} from "../method-usage-repo.js"

const mockDbQuery = vi.mocked(dbQuery)
const mockWithDbTransaction = vi.mocked(withDbTransaction)
const mockIsAirtableRecordId = vi.mocked(isAirtableRecordId)

const fakeRow = {
  id: "uuid-1",
  user_id: "rec123",
  method_id: "recMethod1",
  program_id: "recProg1",
  program_schedule_id: null,
  remark: "Great session",
  used_at: "2025-06-15"
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createMethodUsage", () => {
  it("inserts via transaction and returns mapped row", async () => {
    mockWithDbTransaction.mockImplementationOnce(async (fn) => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 })
      }
      return fn(mockClient as any)
    })

    const result = await createMethodUsage({
      userId: "rec123",
      methodId: "recMethod1",
      programId: "recProg1"
    })

    expect(result.id).toBe("uuid-1")
    expect(result.userId).toBe("rec123")
    expect(result.programId).toBe("recProg1")
  })
})

describe("getMethodUsageById", () => {
  it("returns mapped row when found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await getMethodUsageById("uuid-1")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("uuid-1")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["uuid-1"]
    )
  })

  it("returns null when not found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })

    const result = await getMethodUsageById("nonexistent")
    expect(result).toBeNull()
  })
})

describe("getMethodUsageByAnyId", () => {
  it("returns by primary id if found", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await getMethodUsageByAnyId("uuid-1")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("uuid-1")
  })

  it("falls back to airtable_record_id when primary not found and id is airtable format", async () => {
    // First call (getMethodUsageById) returns nothing
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })
    mockIsAirtableRecordId.mockReturnValueOnce(true)
    // Second call (airtable_record_id lookup) returns data
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await getMethodUsageByAnyId("recXYZ12345678901")
    expect(result).not.toBeNull()
    expect(mockDbQuery).toHaveBeenCalledTimes(2)
    expect(mockDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("airtable_record_id = $1"),
      ["recXYZ12345678901"]
    )
  })

  it("returns null when not found by either id and id is not airtable format", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] })
    mockIsAirtableRecordId.mockReturnValueOnce(false)

    const result = await getMethodUsageByAnyId("not-a-valid-id")
    expect(result).toBeNull()
    expect(mockDbQuery).toHaveBeenCalledTimes(1)
  })
})

describe("updateMethodUsageRemark", () => {
  it("updates by airtable_record_id when id is airtable format", async () => {
    mockIsAirtableRecordId.mockReturnValueOnce(true)
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await updateMethodUsageRemark("recXYZ12345678901", "Updated remark")
    expect(result).not.toBeNull()
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE airtable_record_id = $1"),
      ["recXYZ12345678901", "Updated remark"]
    )
  })

  it("updates by primary id when id is not airtable format", async () => {
    mockIsAirtableRecordId.mockReturnValueOnce(false)
    mockDbQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1, command: "", oid: 0, fields: [] })

    const result = await updateMethodUsageRemark("uuid-1", "Updated remark")
    expect(result).not.toBeNull()
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["uuid-1", "Updated remark"]
    )
  })
})

describe("listLatestByProgram", () => {
  it("returns array of mapped rows ordered by used_at DESC", async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [fakeRow, { ...fakeRow, id: "uuid-2" }],
      rowCount: 2,
      command: "",
      oid: 0,
      fields: []
    })

    const results = await listLatestByProgram("recProg1", 2)
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe("uuid-1")
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY used_at DESC"),
      ["recProg1", 2]
    )
  })
})

describe("toApiMethodUsage", () => {
  it("transforms PgMethodUsage to API format", () => {
    const result = toApiMethodUsage({
      id: "uuid-1",
      userId: "rec123",
      methodId: "recMethod1",
      programId: "recProg1",
      programScheduleId: null,
      remark: "Nice",
      usedAt: "2025-06-15"
    })

    expect(result).toEqual({
      id: "uuid-1",
      userId: "rec123",
      methodId: "recMethod1",
      programId: "recProg1",
      programmaplanningId: undefined,
      usedAt: "2025-06-15",
      remark: "Nice"
    })
  })
})
