import express from "express"
import path from "path"
import cookieParser from "cookie-parser"
import { fileURLToPath } from "url"

// Load secrets early (supports Docker Swarm file-based secrets)
import { loadSecrets } from "./api/_lib/secrets.js"
loadSecrets()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())
app.use(cookieParser())

// Request/Response adapter for Vercel handlers
function wrapVercelHandler(handler: (req: any, res: any) => any) {
  return async (req: express.Request, res: express.Response) => {
    // Add Vercel-style helpers to response
    const vercelRes = res as any
    vercelRes.status = (code: number) => {
      res.status(code)
      return vercelRes
    }
    vercelRes.json = (data: any) => {
      res.json(data)
      return vercelRes
    }
    vercelRes.send = (data: any) => {
      res.send(data)
      return vercelRes
    }

    // Create Vercel-style request wrapper with merged query/params
    const mergedQuery = { ...req.query, ...req.params }
    const vercelReq = new Proxy(req, {
      get(target, prop) {
        if (prop === "query") return mergedQuery
        return (target as any)[prop]
      }
    })

    try {
      const result = handler(vercelReq, vercelRes)
      if (result instanceof Promise) {
        await result
      }
    } catch (error) {
      console.error("API Error:", error)
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" })
      }
    }
  }
}

// Dynamically import and register API routes
async function setupRoutes() {
  // Auth routes
  const { default: loginHandler } = await import("./api/auth/login.js")
  const { default: logoutHandler } = await import("./api/auth/logout.js")
  const { default: refreshHandler } = await import("./api/auth/refresh.js")
  const { default: meHandler } = await import("./api/auth/me.js")
  const { default: setPasswordHandler } = await import("./api/auth/set-password.js")

  app.post("/api/auth/login", wrapVercelHandler(loginHandler))
  app.post("/api/auth/logout", wrapVercelHandler(logoutHandler))
  app.post("/api/auth/refresh", wrapVercelHandler(refreshHandler))
  app.get("/api/auth/me", wrapVercelHandler(meHandler))
  app.post("/api/auth/set-password", wrapVercelHandler(setPasswordHandler))

  // Users routes
  const { default: usersHandler } = await import("./api/users/index.js")
  const { default: userByIdHandler } = await import("./api/users/[id].js")
  const { default: userLookupHandler } = await import("./api/users/lookup.js")
  const { default: changePasswordHandler } = await import("./api/users/change-password.js")

  app.get("/api/users", wrapVercelHandler(usersHandler))
  app.post("/api/users", wrapVercelHandler(usersHandler))
  app.get("/api/users/lookup", wrapVercelHandler(userLookupHandler))
  app.post("/api/users/change-password", wrapVercelHandler(changePasswordHandler))
  app.get("/api/users/:id", wrapVercelHandler(userByIdHandler))
  app.patch("/api/users/:id", wrapVercelHandler(userByIdHandler))

  // Companies routes
  const { default: companyLookupHandler } = await import("./api/companies/lookup.js")
  app.get("/api/companies/lookup", wrapVercelHandler(companyLookupHandler))

  // Programs routes
  const { default: programsHandler } = await import("./api/programs/index.js")
  const { default: programByIdHandler } = await import("./api/programs/[id].js")
  const { default: programMethodsHandler } = await import("./api/programs/[id]/methods.js")
  const { default: generateProgramHandler } = await import("./api/programs/generate.js")

  app.get("/api/programs", wrapVercelHandler(programsHandler))
  app.post("/api/programs", wrapVercelHandler(programsHandler))
  app.post("/api/programs/generate", wrapVercelHandler(generateProgramHandler))
  app.get("/api/programs/:id", wrapVercelHandler(programByIdHandler))
  app.patch("/api/programs/:id", wrapVercelHandler(programByIdHandler))
  app.delete("/api/programs/:id", wrapVercelHandler(programByIdHandler))
  app.get("/api/programs/:id/methods", wrapVercelHandler(programMethodsHandler))

  // Methods routes
  const { default: methodsHandler } = await import("./api/methods/index.js")
  const { default: methodByIdHandler } = await import("./api/methods/[id].js")

  app.get("/api/methods", wrapVercelHandler(methodsHandler))
  app.get("/api/methods/:id", wrapVercelHandler(methodByIdHandler))

  // Goals routes
  const { default: goalsHandler } = await import("./api/goals/index.js")
  app.get("/api/goals", wrapVercelHandler(goalsHandler))

  // Days routes
  const { default: daysHandler } = await import("./api/days/index.js")
  app.get("/api/days", wrapVercelHandler(daysHandler))

  // Method usage routes
  const { default: methodUsageHandler } = await import("./api/method-usage/index.js")
  const { default: methodUsageByProgramHandler } = await import("./api/method-usage/by-program.js")

  app.get("/api/method-usage", wrapVercelHandler(methodUsageHandler))
  app.post("/api/method-usage", wrapVercelHandler(methodUsageHandler))
  app.get("/api/method-usage/by-program", wrapVercelHandler(methodUsageByProgramHandler))

  // Cache routes
  const { default: cacheInvalidateHandler } = await import("./api/cache/invalidate.js")
  app.post("/api/cache/invalidate", wrapVercelHandler(cacheInvalidateHandler))

  // Health check
  const { default: healthHandler } = await import("./api/health.js")
  app.get("/api/health", wrapVercelHandler(healthHandler))

  // Serve static files from Vite build
  const distPath = path.join(__dirname, "dist")
  app.use(express.static(distPath))

  // SPA fallback - serve index.html for all non-API routes
  // Use middleware pattern for Express 5 compatibility
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Don't serve index.html for API routes that weren't matched
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" })
      return
    }
    // Only handle GET requests
    if (req.method !== "GET") {
      next()
      return
    }
    res.sendFile(path.join(distPath, "index.html"))
  })
}

// Start server
setupRoutes().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
  })
}).catch((error) => {
  console.error("Failed to setup routes:", error)
  process.exit(1)
})
