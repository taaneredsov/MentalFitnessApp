import { SignJWT, jwtVerify } from "jose"

const ACCESS_TOKEN_EXPIRY = "1h"  // Extended from 15m for better UX
const REFRESH_TOKEN_EXPIRY = "7d"

// Lazy secret resolution - env vars may not be available at module load time
let _jwtSecret = null

function getJWTSecret() {
  if (!_jwtSecret) {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is required")
    }
    _jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET)
  }
  return _jwtSecret
}

export async function signAccessToken(payload) {
  return new SignJWT({ ...payload, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJWTSecret())
}

export async function signRefreshToken(payload) {
  return new SignJWT({ ...payload, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getJWTSecret())
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret())
    if (payload.typ && payload.typ !== "access") {
      console.error("JWT verification failed: expected access token, got", payload.typ)
      return null
    }
    return payload
  } catch (error) {
    console.error("JWT verification failed:", error.message)
    return null
  }
}

export async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret())
    if (payload.typ && payload.typ !== "refresh") {
      console.error("JWT verification failed: expected refresh token, got", payload.typ)
      return null
    }
    return payload
  } catch (error) {
    console.error("JWT verification failed:", error.message)
    return null
  }
}

// Migration alias: use verifyAccessToken for all existing verifyToken calls
export const verifyToken = verifyAccessToken
