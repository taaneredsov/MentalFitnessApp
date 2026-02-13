// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDestroy = vi.fn()

vi.mock("../../airtable.js", () => ({
  base: vi.fn(() => ({
    create: mockCreate,
    update: mockUpdate,
    destroy: mockDestroy
  })),
  tables: {
    programs: "tblPrograms",
    programmaplanning: "tblPlanning",
    methodUsage: "tblMethodUsage",
    habitUsage: "tblHabitUsage",
    personalGoalUsage: "tblPersonalGoalUsage",
    overtuigingenGebruik: "tblOvertuigingenGebruik",
    users: "tblUsers"
  }
}))

vi.mock("../id-map.js", () => ({
  findAirtableId: vi.fn(),
  upsertAirtableIdMap: vi.fn()
}))

vi.mock("../../db/id-utils.js", () => ({
  isAirtableRecordId: vi.fn()
}))

vi.mock("../../field-mappings.js", () => ({
  PROGRAM_FIELDS: {
    user: "fldUser",
    startDate: "fldStartDate",
    duration: "fldDuration",
    status: "fldStatus",
    creationType: "fldCreationType",
    daysOfWeek: "fldDaysOfWeek",
    goals: "fldGoals",
    methods: "fldMethods",
    overtuigingen: "fldOvertuigingen",
    notes: "fldNotes"
  },
  PROGRAMMAPLANNING_FIELDS: {
    program: "fldProgram",
    date: "fldDate",
    methods: "fldMethods",
    goals: "fldGoals",
    notes: "fldNotes",
    sessionDescription: "fldSessionDesc"
  },
  METHOD_USAGE_FIELDS: {
    user: "fldUser",
    method: "fldMethod",
    usedAt: "fldUsedAt",
    programmaplanning: "fldPlanning",
    program: "fldProgram",
    remark: "fldRemark"
  },
  HABIT_USAGE_FIELDS: {
    user: "fldUser",
    method: "fldMethod",
    date: "fldDate"
  },
  PERSONAL_GOAL_USAGE_FIELDS: {
    user: "fldUser",
    personalGoal: "fldGoal",
    date: "fldDate"
  },
  OVERTUIGING_USAGE_FIELDS: {
    user: "fldUser",
    overtuiging: "fldOvertuiging",
    program: "fldProgram",
    date: "fldDate"
  },
  USER_FIELDS: {
    currentStreak: "fldCurrentStreak",
    longestStreak: "fldLongestStreak",
    lastActiveDate: "fldLastActive",
    lastLogin: "fldLastLogin",
    bonusPoints: "fldBonusPoints",
    badges: "fldBadges",
    level: "fldLevel"
  }
}))

import { base } from "../../airtable.js"
import { findAirtableId, upsertAirtableIdMap } from "../id-map.js"
import { isAirtableRecordId } from "../../db/id-utils.js"
import { writeOutboxEventToAirtable } from "../airtable-writers.js"

const mockBase = vi.mocked(base)
const mockFindAirtableId = vi.mocked(findAirtableId)
const mockUpsertAirtableIdMap = vi.mocked(upsertAirtableIdMap)
const mockIsAirtableRecordId = vi.mocked(isAirtableRecordId)

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAirtableRecordId.mockReturnValue(false)
})

describe("writeOutboxEventToAirtable - upsert", () => {
  describe("program", () => {
    it("creates new program when no existing airtable id", async () => {
      mockFindAirtableId.mockResolvedValue(null)
      mockCreate.mockResolvedValueOnce({ id: "recNewProg" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "program",
        entityId: "uuid-prog",
        payload: { userId: "rec123", startDate: "2025-06-01", duration: 4 }
      })

      expect(mockBase).toHaveBeenCalledWith("tblPrograms")
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fldUser: ["rec123"] }),
        { typecast: true }
      )
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("program", "uuid-prog", "recNewProg")
    })

    it("updates existing program when airtable id exists", async () => {
      mockFindAirtableId.mockResolvedValue("recExisting")

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "program",
        entityId: "uuid-prog",
        payload: { userId: "rec123", startDate: "2025-06-01", duration: 4 }
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        "recExisting",
        expect.objectContaining({ fldUser: ["rec123"] }),
        { typecast: true }
      )
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe("program_schedule", () => {
    it("creates new schedule when no existing airtable id", async () => {
      // First findAirtableId for schedule = null, second for program mapping
      mockFindAirtableId.mockResolvedValueOnce(null)
      mockIsAirtableRecordId.mockReturnValueOnce(true) // programId is airtable id
      mockCreate.mockResolvedValueOnce({ id: "recNewSched" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "program_schedule",
        entityId: "uuid-sched",
        payload: { programId: "recProgAirtable12", date: "2025-06-15", methods: ["recM1"] }
      })

      expect(mockCreate).toHaveBeenCalled()
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("program_schedule", "uuid-sched", "recNewSched")
    })
  })

  describe("method_usage", () => {
    it("creates new method usage when no existing airtable id", async () => {
      mockFindAirtableId.mockResolvedValue(null)
      mockCreate.mockResolvedValueOnce({ id: "recNewMU" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "method_usage",
        entityId: "uuid-mu",
        payload: { userId: "rec123", methodId: "recM1", usedAt: "2025-06-15" }
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fldUser: ["rec123"], fldMethod: ["recM1"] }),
        { typecast: true }
      )
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("method_usage", "uuid-mu", "recNewMU")
    })
  })

  describe("habit_usage", () => {
    it("creates new habit usage when no existing airtable id", async () => {
      mockFindAirtableId.mockResolvedValue(null)
      mockCreate.mockResolvedValueOnce({ id: "recNewHU" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "habit_usage",
        entityId: "uuid-hu",
        payload: { userId: "rec123", methodId: "recM1", date: "2025-06-15" }
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fldUser: ["rec123"], fldMethod: ["recM1"] }),
        { typecast: true }
      )
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("habit_usage", "uuid-hu", "recNewHU")
    })

    it("updates existing habit usage when airtable id exists", async () => {
      mockFindAirtableId.mockResolvedValue("recExistingHU")

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "habit_usage",
        entityId: "uuid-hu",
        payload: { userId: "rec123", methodId: "recM1", date: "2025-06-15" }
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        "recExistingHU",
        expect.objectContaining({ fldUser: ["rec123"] }),
        { typecast: true }
      )
    })
  })

  describe("personal_goal_usage", () => {
    it("creates new personal goal usage when no existing airtable id", async () => {
      mockFindAirtableId.mockResolvedValue(null)
      mockCreate.mockResolvedValueOnce({ id: "recNewPGU" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "personal_goal_usage",
        entityId: "uuid-pgu",
        payload: { userId: "rec123", personalGoalId: "recGoal1", date: "2025-06-15" }
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fldUser: ["rec123"], fldGoal: ["recGoal1"] }),
        { typecast: true }
      )
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("personal_goal_usage", "uuid-pgu", "recNewPGU")
    })
  })

  describe("overtuiging_usage", () => {
    it("creates new overtuiging usage when no existing airtable id", async () => {
      mockFindAirtableId.mockResolvedValue(null)
      mockCreate.mockResolvedValueOnce({ id: "recNewOU" })

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "overtuiging_usage",
        entityId: "uuid-ou",
        payload: { userId: "rec123", overtuigingId: "recOv1", date: "2025-06-15", programId: "recProg1" }
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fldUser: ["rec123"], fldOvertuiging: ["recOv1"] }),
        { typecast: true }
      )
      expect(mockUpsertAirtableIdMap).toHaveBeenCalledWith("overtuiging_usage", "uuid-ou", "recNewOU")
    })
  })

  describe("user", () => {
    it("updates user fields when userId is airtable format", async () => {
      mockIsAirtableRecordId.mockReturnValue(true)

      await writeOutboxEventToAirtable({
        eventType: "upsert",
        entityType: "user",
        entityId: "rec123",
        payload: {
          userId: "recUser12345678901",
          currentStreak: 5,
          longestStreak: 10,
          badges: "[\"eerste_sessie\"]",
          level: 2
        }
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        "recUser12345678901",
        expect.objectContaining({
          fldCurrentStreak: 5,
          fldLongestStreak: 10,
          fldBadges: "[\"eerste_sessie\"]",
          fldLevel: 2
        }),
        { typecast: true }
      )
    })
  })
})

describe("writeOutboxEventToAirtable - delete", () => {
  it("deletes habit_usage by airtable id", async () => {
    mockFindAirtableId.mockResolvedValueOnce("recHUToDelete")

    await writeOutboxEventToAirtable({
      eventType: "delete",
      entityType: "habit_usage",
      entityId: "uuid-hu",
      payload: {}
    })

    expect(mockDestroy).toHaveBeenCalledWith("recHUToDelete")
  })

  it("deletes method_usage by airtable id", async () => {
    mockFindAirtableId.mockResolvedValueOnce("recMUToDelete")

    await writeOutboxEventToAirtable({
      eventType: "delete",
      entityType: "method_usage",
      entityId: "uuid-mu",
      payload: {}
    })

    expect(mockDestroy).toHaveBeenCalledWith("recMUToDelete")
  })

  it("does nothing when no airtable id found for delete", async () => {
    mockFindAirtableId.mockResolvedValueOnce(null)

    await writeOutboxEventToAirtable({
      eventType: "delete",
      entityType: "habit_usage",
      entityId: "uuid-unknown",
      payload: {}
    })

    expect(mockDestroy).not.toHaveBeenCalled()
  })

  it("deletes program by airtable id", async () => {
    mockFindAirtableId.mockResolvedValueOnce("recProgToDelete")

    await writeOutboxEventToAirtable({
      eventType: "delete",
      entityType: "program",
      entityId: "uuid-prog",
      payload: {}
    })

    expect(mockDestroy).toHaveBeenCalledWith("recProgToDelete")
  })

  it("deletes program_schedule by airtable id", async () => {
    mockFindAirtableId.mockResolvedValueOnce("recSchedToDelete")

    await writeOutboxEventToAirtable({
      eventType: "delete",
      entityType: "program_schedule",
      entityId: "uuid-sched",
      payload: {}
    })

    expect(mockDestroy).toHaveBeenCalledWith("recSchedToDelete")
  })
})
