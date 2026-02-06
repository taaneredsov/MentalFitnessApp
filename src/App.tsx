import { Routes, Route, useSearchParams } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/AppLayout"
import { DebugPanel } from "@/components/DebugPanel"
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt"
import { LoginPage } from "@/pages/LoginPage"
import { MagicLinkPage } from "@/pages/MagicLinkPage"
import { VerifyCodePage } from "@/pages/VerifyCodePage"
import { VerifyTokenPage } from "@/pages/VerifyTokenPage"
import { FirstTimeUserPage } from "@/pages/FirstTimeUserPage"
import { SetPasswordPage } from "@/pages/SetPasswordPage"
import { HomePage } from "@/pages/HomePage"
import { ProgramsPage } from "@/pages/ProgramsPage"
import { ProgramDetailPage } from "@/pages/ProgramDetailPage"
import { MethodsPage } from "@/pages/MethodsPage"
import { MethodDetailPage } from "@/pages/MethodDetailPage"
import { OvertuigingenPage } from "@/pages/OvertuigingenPage"
import { AccountPage } from "@/pages/AccountPage"
import { useCacheBust } from "@/hooks/useCacheBust"
import { useVersionCheck } from "@/hooks/useVersionCheck"

function App() {
  const [searchParams] = useSearchParams()
  const isDebugMode = searchParams.get("debug") === "true"

  // Cache management hooks
  useCacheBust()
  useVersionCheck()

  return (
    <>
      <PWAUpdatePrompt />
      {isDebugMode && <DebugPanel />}
      <Routes>
      <Route path="/login" element={<MagicLinkPage />} />
      <Route path="/auth/code" element={<VerifyCodePage />} />
      <Route path="/auth/verify" element={<VerifyTokenPage />} />
      <Route path="/login/password" element={<LoginPage />} />
      <Route path="/first-time" element={<FirstTimeUserPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/programs/:id" element={<ProgramDetailPage />} />
        <Route path="/methods" element={<MethodsPage />} />
        <Route path="/methods/:id" element={<MethodDetailPage />} />
        <Route path="/overtuigingen" element={<OvertuigingenPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
    </>
  )
}

export default App
