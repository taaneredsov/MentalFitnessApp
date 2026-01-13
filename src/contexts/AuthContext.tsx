import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react"
import type { User } from "@/types/user"

interface LoginResult {
  success: true
  needsPasswordSetup?: false
}

interface NeedsPasswordSetupResult {
  success: false
  needsPasswordSetup: true
  userId: string
  email: string
}

type LoginResponse = LoginResult | NeedsPasswordSetupResult

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setAuthFromResponse: (user: User, accessToken: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "accessToken"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  )
  const [isLoading, setIsLoading] = useState(true)

  const setAuthFromResponse = useCallback((user: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setAccessToken(token)
    setUser(user)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
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
        userId: data.data.userId,
        email: data.data.email
      }
    }

    localStorage.setItem(TOKEN_KEY, data.data.accessToken)
    setAccessToken(data.data.accessToken)
    setUser(data.data.user)

    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    localStorage.removeItem(TOKEN_KEY)
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
        localStorage.setItem(TOKEN_KEY, data.data.accessToken)
        setAccessToken(data.data.accessToken)
        setUser(data.data.user)
        return
      }
    } catch {
      // Refresh failed, clear auth state
    }

    localStorage.removeItem(TOKEN_KEY)
    setAccessToken(null)
    setUser(null)
  }, [])

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)

      if (token) {
        try {
          const response = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
          })

          const data = await response.json()

          if (data.success) {
            setUser(data.data)
          } else {
            // Token expired, try refresh
            await refreshAuth()
          }
        } catch {
          await refreshAuth()
        }
      }

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
