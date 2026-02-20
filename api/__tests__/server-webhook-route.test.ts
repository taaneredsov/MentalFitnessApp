import { beforeAll, describe, expect, it } from "vitest"
import { app, setupRoutes } from "../../server.js"

describe("server route wiring", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test"
    await setupRoutes()
  }, 20_000)

  it("registers POST /api/sync/users/inbound during app bootstrap", () => {
    const router = (app as unknown as { router?: { stack?: Array<Record<string, unknown>> } }).router
    const stack = router?.stack || []

    const matched = stack.some((layer) => {
      const route = layer.route as { path?: string; methods?: Record<string, boolean> } | undefined
      if (!route) return false
      return route.path === "/api/sync/users/inbound" && route.methods?.post === true
    })

    expect(matched).toBe(true)
  })
})
