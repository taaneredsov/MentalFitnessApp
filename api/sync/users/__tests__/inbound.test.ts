import crypto from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  ensureInboundEventNotDuplicate: vi.fn(),
  syncUserRecords: vi.fn(),
  dbQuery: vi.fn()
}))

vi.mock("../../../_lib/sync/user-fast-lane.js", () => ({
  ensureInboundEventNotDuplicate: mocks.ensureInboundEventNotDuplicate,
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

  it("rejects missing signature", async () => {
    const req = {
      method: "POST",
      headers: {},
      body: { eventId: "evt-1" }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.payload).toEqual({ success: false, error: "Missing signature" })
  })

  it("validates signature against rawBody (not JSON.stringify(parsedBody))", async () => {
    const rawBody = "{\"eventId\":\"evt-2\",\"eventType\":\"user.created\",\"occurredAt\":\"2026-02-20T10:00:00.000Z\",\"user\":{\"id\":\"recUser1\",\"email\":\"a@example.com\",\"name\":\"A\"}}"
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex")

    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(true)
    mocks.syncUserRecords.mockResolvedValueOnce([{ id: "recUser1" }])

    const req = {
      method: "POST",
      headers: { "x-signature": `sha256=${signature}` },
      rawBody,
      // Parsed object can differ from raw formatting; handler should still use rawBody.
      body: {
        eventId: "evt-2",
        eventType: "user.created",
        occurredAt: "2026-02-20T10:00:00.000Z",
        user: { id: "recUser1", email: "a@example.com", name: "A" }
      }
    }
    const res = createRes()

    await handler(req as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(mocks.ensureInboundEventNotDuplicate).toHaveBeenCalledWith("evt-2", "user_webhook")
    expect(mocks.syncUserRecords).toHaveBeenCalledTimes(1)
    expect(res.payload).toEqual({
      success: true,
      data: { eventId: "evt-2", status: "processed" }
    })
  })

  it("deduplicates already-seen events", async () => {
    const rawBody = "{\"eventId\":\"evt-3\",\"eventType\":\"user.updated\",\"occurredAt\":\"2026-02-20T10:00:00.000Z\",\"user\":{\"id\":\"recUser1\",\"email\":\"a@example.com\",\"name\":\"A\"}}"
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex")

    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(false)

    const req = {
      method: "POST",
      headers: { "x-signature": signature },
      rawBody,
      body: {
        eventId: "evt-3",
        eventType: "user.updated",
        occurredAt: "2026-02-20T10:00:00.000Z",
        user: { id: "recUser1", email: "a@example.com", name: "A" }
      }
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

  it("processes user.deleted by updating status in Postgres", async () => {
    const rawBody = "{\"eventId\":\"evt-4\",\"eventType\":\"user.deleted\",\"occurredAt\":\"2026-02-20T10:00:00.000Z\",\"user\":{\"id\":\"recUserDelete\",\"email\":\"d@example.com\",\"name\":\"D\"}}"
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex")

    mocks.ensureInboundEventNotDuplicate.mockResolvedValueOnce(true)
    mocks.dbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const req = {
      method: "POST",
      headers: { "x-signature": signature },
      rawBody,
      body: {
        eventId: "evt-4",
        eventType: "user.deleted",
        occurredAt: "2026-02-20T10:00:00.000Z",
        user: { id: "recUserDelete", email: "d@example.com", name: "D" }
      }
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
