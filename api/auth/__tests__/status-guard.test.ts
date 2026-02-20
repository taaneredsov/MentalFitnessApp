import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verifyRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
  getUserByIdWithReadThrough: vi.fn(),
  getUserByEmailWithReadThrough: vi.fn()
}))

vi.mock("../../_lib/jwt.js", () => ({
  verifyRefreshToken: mocks.verifyRefreshToken,
  verifyToken: mocks.verifyToken,
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn()
}))

vi.mock("../../_lib/db/client.js", () => ({
  isPostgresConfigured: () => true
}))

vi.mock("../../_lib/sync/user-readthrough.js", () => ({
  getUserByIdWithReadThrough: mocks.getUserByIdWithReadThrough,
  getUserByEmailWithReadThrough: mocks.getUserByEmailWithReadThrough,
  toApiUserPayload: (user: Record<string, unknown>) => user
}))

vi.mock("../../_lib/airtable.js", () => ({
  base: vi.fn(),
  tables: { users: "tblUsers" }
}))

import refreshHandler from "../refresh.js"
import meHandler from "../me.js"

function createRes() {
  const headers: Record<string, string[]> = {}
  const res = {
    statusCode: 200,
    payload: undefined as unknown,
    setHeader(name: string, value: string[]) {
      headers[name] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: unknown) {
      this.payload = data
      return this
    },
    _headers: headers
  }
  return res
}

describe("auth status guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refresh rejects disabled/deleted postgres users", async () => {
    mocks.verifyRefreshToken.mockResolvedValueOnce({
      userId: "recUser1",
      email: "u@example.com"
    })
    mocks.getUserByIdWithReadThrough.mockResolvedValueOnce({
      id: "recUser1",
      email: "u@example.com",
      status: "deleted"
    })

    const req = {
      method: "POST",
      headers: { cookie: "refreshToken=token123" }
    }
    const res = createRes()

    await refreshHandler(req as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.payload).toEqual({
      success: false,
      error: "Account is disabled"
    })
    expect(res._headers["Set-Cookie"]?.[0]).toContain("Max-Age=0")
  })

  it("me rejects disabled/deleted postgres users", async () => {
    mocks.verifyToken.mockResolvedValueOnce({
      userId: "recUser2",
      email: "disabled@example.com"
    })
    mocks.getUserByIdWithReadThrough.mockResolvedValueOnce({
      id: "recUser2",
      email: "disabled@example.com",
      status: "disabled"
    })

    const req = {
      method: "GET",
      headers: { authorization: "Bearer access-token" }
    }
    const res = createRes()

    await meHandler(req as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.payload).toEqual({
      success: false,
      error: "Account is disabled"
    })
  })
})
