import { render, type RenderOptions } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import type { ReactElement, ReactNode } from "react"
import { AuthProvider } from "@/contexts/AuthContext"

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

interface TestProvidersProps {
  children: ReactNode
  initialEntries?: string[]
}

function TestProviders({ children, initialEntries = ["/"] }: TestProvidersProps) {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Simple providers without auth for components that don't need it
function SimpleProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[]
  withAuth?: boolean
}

// Custom render function that wraps components with all providers
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { initialEntries, withAuth = false, ...renderOptions } = options

  if (withAuth) {
    return render(ui, {
      wrapper: ({ children }) => (
        <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
      ),
      ...renderOptions,
    })
  }

  return render(ui, { wrapper: SimpleProviders, ...renderOptions })
}

// Re-export everything from testing-library
export * from "@testing-library/react"
export { default as userEvent } from "@testing-library/user-event"
