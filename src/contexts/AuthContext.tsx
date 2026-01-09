import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react"
import type { User } from "@/types/user"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "accessToken"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Login failed")
    }

    localStorage.setItem(TOKEN_KEY, data.data.accessToken)
    setUser(data.data.user)
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    localStorage.removeItem(TOKEN_KEY)
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
        setUser(data.data.user)
        return
      }
    } catch {
      // Refresh failed, clear auth state
    }

    localStorage.removeItem(TOKEN_KEY)
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
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshAuth
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
