import type { AddressInfo } from "net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app, setupRoutes } from "../../server.js"

let server: ReturnType<typeof app.listen>
let baseUrl = ""

describe("server route wiring", () => {
  beforeAll(async () => {
    process.env.USER_WEBHOOK_SYNC_ENABLED = "false"

    await setupRoutes()
    server = app.listen(0)

    await new Promise<void>((resolve) => {
      server.on("listening", () => resolve())
    })

    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => (err ? reject(err) : resolve()))
    })
  })

  it("dispatches POST /api/sync/users/inbound to the webhook handler", async () => {
    const res = await fetch(`${baseUrl}/api/sync/users/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    })

    // If route is not wired, API middleware returns 404 for unknown /api/* path.
    expect(res.status).toBe(503)
    const json = await res.json() as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toContain("disabled")
  })
})

