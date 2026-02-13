import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react"
import type { User } from "@/types/user"
import { syncLanguageWithUserPreference } from "@/lib/i18n"

interface LoginResult {
  success: true
  needsPasswordSetup?: false
}

interface NeedsPasswordSetupResult {
  success: false
  needsPasswordSetup: true
  email: string
}

type LoginResponse = LoginResult | NeedsPasswordSetupResult

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password?: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setAuthFromResponse: (user: User, accessToken: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setAuthFromResponse = useCallback((user: User, token: string) => {
    setAccessToken(token)
    setUser(user)
    void syncLanguageWithUserPreference(user.languageCode)
  }, [])

  const login = useCallback(async (email: string, password?: string): Promise<LoginResponse> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...(password && { password }) })
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Login failed")
    }

    // Check if user needs to set up password
    if (data.data.needsPasswordSetup) {
      return {
        success: false,
        needsPasswordSetup: true,
        email: data.data.email
      }
    }

    setAccessToken(data.data.accessToken)
    setUser(data.data.user)
    void syncLanguageWithUserPreference(data.data.user.languageCode)

    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include"
      })

      const data = await response.json()

      if (data.success) {
        setAccessToken(data.data.accessToken)
        setUser(data.data.user)
        void syncLanguageWithUserPreference(data.data.user.languageCode)
        return
      }
    } catch {
      // Refresh failed, clear auth state
    }

    setAccessToken(null)
    setUser(null)
  }, [])

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      await refreshAuth()
      setIsLoading(false)
    }

    initAuth()
  }, [refreshAuth])

  // Auto-refresh token every 10 minutes
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      refreshAuth()
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user, refreshAuth])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshAuth,
        setAuthFromResponse
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
