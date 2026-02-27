import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  ensureInboundEventNotDuplicate: vi.fn(),
  fetchUserFromAirtableById: vi.fn(),
  syncUserRecords: vi.fn(),
  dbQuery: vi.fn()
}))

vi.mock("../../../_lib/sync/user-fast-lane.js", () => ({
  ensureInboundEventNotDuplicate: mocks.ensureInboundEventNotDuplicate,
  fetchUserFromAirtableById: mocks.fetchUserFromAirtableById,
  syncUserRecords: mocks.syncUserRecords
}))

vi.mock("../../../_lib/db/client.js", () => ({
  dbQuery: mocks.dbQuery
}))

import handler from "../inbound.js"

function createRes() {
  const res = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: unknown) {
      this.payload = data
      return this
    }
  }
  return res
}

describe("POST /api/sync/users/inbound", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.USER_WEBHOOK_SYNC_ENABLED = "true"
    process.env.AIRTABLE_USER_SYNC_SECRET = "webhook-secret"
  })

  it("rejects missing x-sync-secret header", async () => {
    const req = {
      method: "POST",
      headers: {},
      body: { recordId: "recUser1" }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.payload).toEqual({ success: false, error: "Unauthorized" })
  })

  it("syncs a user when record exists in Airtable", async () => {
    const fakeRecord = { id: "recUser1", email: "a@example.com", status: "active" }
    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(true)
    mocks.fetchUserFromAirtableById.mockResolvedValueOnce(fakeRecord)
    mocks.syncUserRecords.mockResolvedValueOnce(undefined)

    const req = {
      method: "POST",
      headers: { "x-sync-secret": "webhook-secret" },
      body: { recordId: "recUser1" }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(mocks.fetchUserFromAirtableById).toHaveBeenCalledWith("recUser1")
    expect(mocks.syncUserRecords).toHaveBeenCalledWith([fakeRecord])
    expect(res.payload).toEqual({
      success: true,
      data: expect.objectContaining({ status: "synced" })
    })
  })

  it("deduplicates already-seen events", async () => {
    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(false)

    const req = {
      method: "POST",
      headers: { "x-sync-secret": "webhook-secret" },
      body: { recordId: "recUser1", eventId: "evt-3" }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(mocks.syncUserRecords).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({
      success: true,
      data: { eventId: "evt-3", deduplicated: true }
    })
  })

  it("marks user as deleted when not found in Airtable", async () => {
    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(true)
    mocks.fetchUserFromAirtableById.mockResolvedValueOnce(null)
    mocks.dbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const req = {
      method: "POST",
      headers: { "x-sync-secret": "webhook-secret" },
      body: { recordId: "recUserDelete", eventId: "evt-4" }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(mocks.dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users_pg SET status = 'deleted'"),
      ["recUserDelete"]
    )
    expect(mocks.syncUserRecords).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
  })
})
