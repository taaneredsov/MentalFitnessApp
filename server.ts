import express from "express"
import path from "path"
import { existsSync } from "fs"
import cookieParser from "cookie-parser"
import { fileURLToPath } from "url"

// Load secrets early (supports Docker Swarm file-based secrets)
import { loadSecrets } from "./api/_lib/secrets.js"
loadSecrets()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

function resolveDistPath() {
  const candidates = [
    path.join(__dirname, "dist"),
    path.join(__dirname, "..", "dist"),
    path.join(process.cwd(), "dist")
  ]

  const found = candidates.find((candidate) => existsSync(path.join(candidate, "index.html")))
  return found || candidates[0]
}

// Middleware
app.use(express.json())
app.use(cookieParser())

// Security headers
app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  next()
})

// Dynamically import and register API routes
async function setupRoutes() {
  // Auth routes
  const { default: loginHandler } = await import("./api/auth/login.js")
  const { default: logoutHandler } = await import("./api/auth/logout.js")
  const { default: refreshHandler } = await import("./api/auth/refresh.js")
  const { default: meHandler } = await import("./api/auth/me.js")
  const { default: setPasswordHandler } = await import("./api/auth/set-password.js")
  const { default: magicLinkHandler } = await import("./api/auth/magic-link.js")
  const { default: verifyTokenHandler } = await import("./api/auth/verify.js")
  const { default: verifyCodeHandler } = await import("./api/auth/verify-code.js")

  app.post("/api/auth/login", loginHandler)
  app.post("/api/auth/logout", logoutHandler)
  app.post("/api/auth/refresh", refreshHandler)
  app.get("/api/auth/me", meHandler)
  app.post("/api/auth/set-password", setPasswordHandler)
  app.post("/api/auth/magic-link", magicLinkHandler)
  app.get("/api/auth/verify", verifyTokenHandler)
  app.post("/api/auth/verify-code", verifyCodeHandler)

  // Users routes
  const { default: usersHandler } = await import("./api/users/index.js")
  const { default: userByIdHandler } = await import("./api/users/[id].js")
  const { default: userLookupHandler } = await import("./api/users/lookup.js")
  const { default: changePasswordHandler } = await import("./api/users/change-password.js")

  app.get("/api/users", usersHandler)
  app.post("/api/users", usersHandler)
  app.get("/api/users/lookup", userLookupHandler)
  app.post("/api/users/change-password", changePasswordHandler)
  app.get("/api/users/:id", userByIdHandler)
  app.patch("/api/users/:id", userByIdHandler)

  // Companies routes
  const { default: companyLookupHandler } = await import("./api/companies/lookup.js")
  app.get("/api/companies/lookup", companyLookupHandler)

  // Programs routes
  const { default: programsHandler } = await import("./api/programs/index.js")
  const { default: programByIdHandler } = await import("./api/programs/[id].js")
  const { default: programMethodsHandler } = await import("./api/programs/[id]/methods.js")
  const { default: generateProgramHandler } = await import("./api/programs/generate.js")
  const { default: previewProgramHandler } = await import("./api/programs/preview.js")
  const { default: confirmProgramHandler } = await import("./api/programs/confirm.js")

  app.get("/api/programs", programsHandler)
  app.post("/api/programs", programsHandler)
  app.post("/api/programs/generate", generateProgramHandler)
  app.post("/api/programs/preview", previewProgramHandler)
  app.post("/api/programs/confirm", confirmProgramHandler)
  app.get("/api/programs/:id", programByIdHandler)
  app.patch("/api/programs/:id", programByIdHandler)
  app.delete("/api/programs/:id", programByIdHandler)
  app.get("/api/programs/:id/methods", programMethodsHandler)

  // Program schedule routes
  const { default: regenerateScheduleHandler } = await import("./api/programs/[id]/regenerate-schedule.js")
  const { default: schedulePlanningHandler } = await import("./api/programs/[id]/schedule/[planningId].js")

  app.post("/api/programs/:id/regenerate-schedule", regenerateScheduleHandler)
  app.patch("/api/programs/:id/schedule/:planningId", schedulePlanningHandler)

  // Methods routes
  const { default: methodsHandler } = await import("./api/methods/index.js")
  const { default: methodByIdHandler } = await import("./api/methods/[id].js")
  const { default: habitsHandler } = await import("./api/methods/habits.js")

  app.get("/api/methods", methodsHandler)
  app.get("/api/methods/habits", habitsHandler)
  app.get("/api/methods/:id", methodByIdHandler)

  // Goals routes
  const { default: goalsHandler } = await import("./api/goals/index.js")
  app.get("/api/goals", goalsHandler)

  // Days routes
  const { default: daysHandler } = await import("./api/days/index.js")
  app.get("/api/days", daysHandler)

  // Method usage routes
  const { default: methodUsageHandler } = await import("./api/method-usage/index.js")
  const { default: methodUsageByProgramHandler } = await import("./api/method-usage/by-program.js")

  app.get("/api/method-usage", methodUsageHandler)
  app.post("/api/method-usage", methodUsageHandler)
  app.patch("/api/method-usage/:id", methodUsageHandler)
  app.get("/api/method-usage/by-program", methodUsageByProgramHandler)

  // Rewards routes
  const { default: rewardsHandler } = await import("./api/rewards/index.js")
  const { default: awardRewardsHandler } = await import("./api/rewards/award.js")

  app.get("/api/rewards", rewardsHandler)
  app.post("/api/rewards/award", awardRewardsHandler)

  // Habit usage routes
  const { default: habitUsageHandler } = await import("./api/habit-usage/index.js")

  app.get("/api/habit-usage", habitUsageHandler)
  app.post("/api/habit-usage", habitUsageHandler)
  app.delete("/api/habit-usage", habitUsageHandler)

  // Personal goals routes
  const { default: personalGoalsHandler } = await import("./api/personal-goals/index.js")
  const { default: personalGoalByIdHandler } = await import("./api/personal-goals/[id].js")

  app.get("/api/personal-goals", personalGoalsHandler)
  app.post("/api/personal-goals", personalGoalsHandler)
  app.get("/api/personal-goals/:id", personalGoalByIdHandler)
  app.patch("/api/personal-goals/:id", personalGoalByIdHandler)
  app.delete("/api/personal-goals/:id", personalGoalByIdHandler)

  // Personal goal usage routes
  const { default: personalGoalUsageHandler } = await import("./api/personal-goal-usage/index.js")

  app.get("/api/personal-goal-usage", personalGoalUsageHandler)
  app.post("/api/personal-goal-usage", personalGoalUsageHandler)

  // Overtuigingen routes
  const { default: overtuigingenHandler } = await import("./api/overtuigingen/index.js")
  const { default: overtuigingenByGoalsHandler } = await import("./api/overtuigingen/by-goals.js")
  const { default: mindsetCategoriesHandler } = await import("./api/mindset-categories/index.js")
  app.get("/api/overtuigingen", overtuigingenHandler)
  app.get("/api/overtuigingen/by-goals", overtuigingenByGoalsHandler)
  app.get("/api/mindset-categories", mindsetCategoriesHandler)

  // Overtuiging usage routes
  const { default: overtuigingUsageHandler } = await import("./api/overtuiging-usage/index.js")
  app.get("/api/overtuiging-usage", overtuigingUsageHandler)
  app.post("/api/overtuiging-usage", overtuigingUsageHandler)

  // Persoonlijke overtuigingen routes
  const { default: persoonlijkeOvertuigingenHandler } = await import("./api/persoonlijke-overtuigingen/index.js")
  const { default: persoonlijkeOvertuigingByIdHandler } = await import("./api/persoonlijke-overtuigingen/[id].js")
  app.get("/api/persoonlijke-overtuigingen", persoonlijkeOvertuigingenHandler)
  app.post("/api/persoonlijke-overtuigingen", persoonlijkeOvertuigingenHandler)
  app.patch("/api/persoonlijke-overtuigingen/:id", persoonlijkeOvertuigingByIdHandler)
  app.delete("/api/persoonlijke-overtuigingen/:id", persoonlijkeOvertuigingByIdHandler)

  // Cache routes
  const { default: cacheInvalidateHandler } = await import("./api/cache/invalidate.js")
  app.post("/api/cache/invalidate", cacheInvalidateHandler)

  // Sync routes
  const { default: syncInboundHandler } = await import("./api/sync/inbound.js")
  const { default: replayDeadLetterHandler } = await import("./api/sync/replay-dead-letter.js")
  app.post("/api/sync/inbound", syncInboundHandler)
  app.post("/api/sync/replay-dead-letter", replayDeadLetterHandler)

  // Notifications routes
  const { default: notificationSubscribeHandler } = await import("./api/notifications/subscribe.js")
  const { default: notificationPreferencesHandler } = await import("./api/notifications/preferences.js")
  const { default: notificationTestHandler } = await import("./api/notifications/test.js")
  app.post("/api/notifications/subscribe", notificationSubscribeHandler)
  app.delete("/api/notifications/subscribe", notificationSubscribeHandler)
  app.get("/api/notifications/preferences", notificationPreferencesHandler)
  app.patch("/api/notifications/preferences", notificationPreferencesHandler)
  app.post("/api/notifications/test", notificationTestHandler)

  // Health check
  const { default: healthHandler } = await import("./api/health.js")
  app.get("/api/health", healthHandler)

  // Serve static files from Vite build
  // In Docker: server.js is at /app/server.js, dist/ is at /app/dist/
  // In dev: server runs from project root, dist/ is relative to cwd
  const distPath = resolveDistPath()
  console.log(`Serving static files from: ${distPath}`)
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

  // Error handling middleware (last-resort safety net)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API Error:", err)
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" })
    }
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
