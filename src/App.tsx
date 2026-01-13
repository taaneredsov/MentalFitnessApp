import { Routes, Route } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { SetPasswordPage } from "@/pages/SetPasswordPage"
import { HomePage } from "@/pages/HomePage"
import { ProgramsPage } from "@/pages/ProgramsPage"
import { ProgramDetailPage } from "@/pages/ProgramDetailPage"
import { Tab2Page } from "@/pages/Tab2Page"
import { AccountPage } from "@/pages/AccountPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="/tab2" element={<Tab2Page />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
  )
}

export default App
