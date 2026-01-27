import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders, userEvent } from "@/test/test-utils"
import { ProgramCard } from "../ProgramCard"
import type { Program, Method } from "@/types/program"

// Extend Program with methodDetails for testing
type ProgramWithDetails = Program & {
  methodDetails: Method[]
}

const mockProgram: ProgramWithDetails = {
  id: "rec123",
  name: "Mental Fitness Program 2024",
  startDate: "2024-01-15",
  endDate: "2024-03-15",
  duration: "8 weken",
  daysOfWeek: ["recMon", "recWed", "recFri"],
  frequency: 3,
  goals: ["recGoal1"],
  methods: ["recMethod1"],
  methodUsageCount: 6,
  totalMethods: 24,      // 8 weeks × 3 per week = 24 total
  completedMethods: 6,   // 6 completed = 25%
  methodDetails: [
    { id: "m1", name: "Meditation", duration: 15 },
    { id: "m2", name: "Breathing", duration: 25 },
  ],
}

describe("ProgramCard", () => {
  it("displays program name", () => {
    renderWithProviders(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText("Mental Fitness Program 2024")).toBeInTheDocument()
  })

  it("displays date range", () => {
    renderWithProviders(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    // Dates are formatted as "15 jan. - 15 mrt." in nl-NL locale
    expect(screen.getByText(/15.*-.*15/)).toBeInTheDocument()
  })

  it("displays frequency per week", () => {
    renderWithProviders(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText("3x per week")).toBeInTheDocument()
  })

  it("displays duration range from method details", () => {
    renderWithProviders(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    // With durations 15 and 25, should show "15-25 min"
    expect(screen.getByText("15-25 min")).toBeInTheDocument()
  })

  it("hides duration when no methods with duration", () => {
    const programWithNoMethods = {
      ...mockProgram,
      methodDetails: [],
    }

    renderWithProviders(
      <ProgramCard
        program={programWithNoMethods}
        status="running"
        onClick={() => {}}
      />
    )

    expect(screen.queryByText(/min/)).not.toBeInTheDocument()
  })

  describe("status badges", () => {
    it("shows 'Actief' badge for running program", () => {
      renderWithProviders(
        <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
      )

      expect(screen.getByText("Actief")).toBeInTheDocument()
    })

    it("shows 'Gepland' badge for planned program", () => {
      renderWithProviders(
        <ProgramCard program={mockProgram} status="planned" onClick={() => {}} />
      )

      expect(screen.getByText("Gepland")).toBeInTheDocument()
    })

    it("shows 'Afgerond' badge for finished program", () => {
      renderWithProviders(
        <ProgramCard
          program={mockProgram}
          status="finished"
          onClick={() => {}}
        />
      )

      expect(screen.getByText("Afgerond")).toBeInTheDocument()
    })
  })

  describe("progress display", () => {
    it("shows progress for running programs", () => {
      renderWithProviders(
        <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
      )

      expect(screen.getByText("Voortgang")).toBeInTheDocument()
      // With 6 completed out of 8 weeks × 3 frequency = 24 expected = 25%
      expect(screen.getByText("25%")).toBeInTheDocument()
    })

    it("does not show progress for planned programs", () => {
      renderWithProviders(
        <ProgramCard program={mockProgram} status="planned" onClick={() => {}} />
      )

      expect(screen.queryByText("Voortgang")).not.toBeInTheDocument()
    })

    it("does not show progress for finished programs", () => {
      renderWithProviders(
        <ProgramCard
          program={mockProgram}
          status="finished"
          onClick={() => {}}
        />
      )

      expect(screen.queryByText("Voortgang")).not.toBeInTheDocument()
    })
  })

  describe("click handling", () => {
    it("calls onClick when card is clicked", async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      renderWithProviders(
        <ProgramCard
          program={mockProgram}
          status="running"
          onClick={handleClick}
        />
      )

      const card = screen.getByText("Mental Fitness Program 2024").closest(
        ".cursor-pointer"
      )
      if (card) {
        await user.click(card)
      }

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe("program without name", () => {
    it("does not render name heading when name is missing", () => {
      const programWithoutName = { ...mockProgram, name: undefined }

      renderWithProviders(
        <ProgramCard
          program={programWithoutName}
          status="running"
          onClick={() => {}}
        />
      )

      // Check that other content still renders
      expect(screen.getByText("3x per week")).toBeInTheDocument()
      // But no program name heading
      expect(
        screen.queryByText("Mental Fitness Program 2024")
      ).not.toBeInTheDocument()
    })
  })
})
