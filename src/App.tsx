import { Routes, Route } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { HomePage } from "@/pages/HomePage"
import { Tab1Page } from "@/pages/Tab1Page"
import { Tab2Page } from "@/pages/Tab2Page"
import { Tab3Page } from "@/pages/Tab3Page"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/tab1" element={<Tab1Page />} />
        <Route path="/tab2" element={<Tab2Page />} />
        <Route path="/tab3" element={<Tab3Page />} />
      </Route>
    </Routes>
  )
}

export default App
