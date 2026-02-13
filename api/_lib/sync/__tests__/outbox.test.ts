// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../db/client.js", () => ({
  dbQuery: vi.fn()
}))

import { dbQuery } from "../../db/client.js"
import { enqueueSyncEvent } from "../outbox.js"

const mockDbQuery = vi.mocked(dbQuery)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("enqueueSyncEvent", () => {
  it("uses dbQuery when no client is provided", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "method_usage",
      entityId: "uuid-1",
      payload: { userId: "rec123" }
    })

    expect(mockDbQuery).toHaveBeenCalledTimes(1)
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sync_outbox"),
      expect.arrayContaining(["upsert", "method_usage", "uuid-1"])
    )
  })

  it("uses client.query when a client is provided", async () => {
    const mockClient = { query: vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 }) }

    await enqueueSyncEvent(
      {
        eventType: "delete",
        entityType: "habit_usage",
        entityId: "uuid-2",
        payload: {}
      },
      mockClient as unknown as import("pg").PoolClient
    )

    expect(mockDbQuery).not.toHaveBeenCalled()
    expect(mockClient.query).toHaveBeenCalledTimes(1)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sync_outbox"),
      expect.arrayContaining(["delete", "habit_usage", "uuid-2"])
    )
  })

  it("generates consistent idempotency keys for same input", async () => {
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    const options = {
      eventType: "upsert" as const,
      entityType: "user" as const,
      entityId: "rec123",
      payload: { name: "Test" }
    }

    await enqueueSyncEvent(options)
    await enqueueSyncEvent(options)

    const firstKey = mockDbQuery.mock.calls[0][1]![5]
    const secondKey = mockDbQuery.mock.calls[1][1]![5]
    expect(firstKey).toBe(secondKey)
  })

  it("includes ON CONFLICT DO NOTHING in SQL", async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] })

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: "uuid-3"
    })

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (idempotency_key) DO NOTHING"),
      expect.any(Array)
    )
  })
})
