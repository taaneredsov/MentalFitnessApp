import { describe, it, expect } from "vitest"
import {
  transformUser,
  transformCompany,
  transformProgram,
  transformGoal,
  transformMethod,
  transformExperienceLevel,
  transformMedia,
  transformDay,
  transformMethodUsage,
  transformProgramPrompt,
  transformProgrammaplanning,
  USER_FIELDS,
  COMPANY_FIELDS,
  PROGRAM_FIELDS,
  GOAL_FIELDS,
  METHOD_FIELDS,
  EXPERIENCE_LEVEL_FIELDS,
  MEDIA_FIELDS,
  DAY_FIELDS,
  METHOD_USAGE_FIELDS,
  PROGRAM_PROMPT_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
} from "../field-mappings.js"

describe("transformUser", () => {
  it("transforms Airtable user record to User object", () => {
    const record = {
      id: "recUser123",
      fields: {
        [USER_FIELDS.name]: "John Doe",
        [USER_FIELDS.email]: "john@example.com",
        [USER_FIELDS.company]: ["recCompany1"],
        [USER_FIELDS.role]: "Admin",
        [USER_FIELDS.languageCode]: "nl",
        [USER_FIELDS.profilePhoto]: [{ url: "https://example.com/photo.jpg" }],
        [USER_FIELDS.createdAt]: "2024-01-01T00:00:00.000Z",
        [USER_FIELDS.lastLogin]: "2024-06-01",
      },
    }

    const result = transformUser(record)

    expect(result).toEqual({
      id: "recUser123",
      name: "John Doe",
      email: "john@example.com",
      company: ["recCompany1"],
      role: "Admin",
      languageCode: "nl",
      profilePhoto: "https://example.com/photo.jpg",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastLogin: "2024-06-01",
    })
  })

  it("handles missing optional fields", () => {
    const record = {
      id: "recUser456",
      fields: {
        [USER_FIELDS.name]: "Jane Doe",
        [USER_FIELDS.email]: "jane@example.com",
      },
    }

    const result = transformUser(record)

    expect(result.id).toBe("recUser456")
    expect(result.name).toBe("Jane Doe")
    expect(result.email).toBe("jane@example.com")
    expect(result.profilePhoto).toBeUndefined()
  })
})

describe("transformCompany", () => {
  it("transforms Airtable company record to Company object", () => {
    const record = {
      id: "recCompany123",
      fields: {
        [COMPANY_FIELDS.name]: "Acme Corp",
        [COMPANY_FIELDS.logo]: [{ url: "https://example.com/logo.png" }],
        [COMPANY_FIELDS.address]: "123 Main St",
        [COMPANY_FIELDS.city]: "Amsterdam",
        [COMPANY_FIELDS.country]: "Netherlands",
      },
    }

    const result = transformCompany(record)

    expect(result).toEqual({
      id: "recCompany123",
      name: "Acme Corp",
      logo: "https://example.com/logo.png",
      address: "123 Main St",
      city: "Amsterdam",
      country: "Netherlands",
    })
  })

  it("handles missing logo", () => {
    const record = {
      id: "recCompany456",
      fields: {
        [COMPANY_FIELDS.name]: "Small Corp",
      },
    }

    const result = transformCompany(record)

    expect(result.logo).toBeUndefined()
  })
})

describe("transformProgram", () => {
  it("transforms Airtable program record to Program object", () => {
    const record = {
      id: "recProgram123",
      fields: {
        [PROGRAM_FIELDS.programId]: "MF-2024-001",
        [PROGRAM_FIELDS.startDate]: "2024-01-15",
        [PROGRAM_FIELDS.endDate]: "2024-03-15",
        [PROGRAM_FIELDS.duration]: "8 weken",
        [PROGRAM_FIELDS.daysOfWeek]: ["recMon", "recWed", "recFri"],
        [PROGRAM_FIELDS.frequency]: 3,
        [PROGRAM_FIELDS.goals]: ["recGoal1", "recGoal2"],
        [PROGRAM_FIELDS.methods]: ["recMethod1"],
        [PROGRAM_FIELDS.notes]: "Test program notes",
        [PROGRAM_FIELDS.methodUsage]: ["recUsage1", "recUsage2"],
      },
    }

    const result = transformProgram(record)

    expect(result).toEqual({
      id: "recProgram123",
      name: "MF-2024-001",
      startDate: "2024-01-15",
      endDate: "2024-03-15",
      duration: "8 weken",
      daysOfWeek: ["recMon", "recWed", "recFri"],
      frequency: 3,
      goals: ["recGoal1", "recGoal2"],
      methods: ["recMethod1"],
      notes: "Test program notes",
      methodUsageCount: 2,
      milestonesAwarded: [],
      status: null,
      creationType: "Manueel",
      overtuigingen: [],
    })
  })

  it("handles European date format (DD/MM/YYYY) for endDate", () => {
    const record = {
      id: "recProgram456",
      fields: {
        [PROGRAM_FIELDS.startDate]: "2024-01-15",
        [PROGRAM_FIELDS.endDate]: "15/03/2024",
        [PROGRAM_FIELDS.duration]: "8 weken",
      },
    }

    const result = transformProgram(record)

    expect(result.endDate).toBe("2024-03-15")
  })

  it("defaults empty arrays for missing linked fields", () => {
    const record = {
      id: "recProgram789",
      fields: {
        [PROGRAM_FIELDS.startDate]: "2024-01-15",
        [PROGRAM_FIELDS.duration]: "4 weken",
      },
    }

    const result = transformProgram(record)

    expect(result.daysOfWeek).toEqual([])
    expect(result.goals).toEqual([])
    expect(result.methods).toEqual([])
    expect(result.frequency).toBe(0)
    expect(result.methodUsageCount).toBe(0)
  })
})

describe("transformGoal", () => {
  it("transforms Airtable goal record to Goal object", () => {
    const record = {
      id: "recGoal123",
      fields: {
        [GOAL_FIELDS.name]: "Reduce Stress",
        [GOAL_FIELDS.description]: "Learn techniques to manage daily stress",
        [GOAL_FIELDS.status]: "Actief",
      },
    }

    const result = transformGoal(record)

    expect(result).toEqual({
      id: "recGoal123",
      name: "Reduce Stress",
      description: "Learn techniques to manage daily stress",
      status: "Actief",
    })
  })
})

describe("transformMethod", () => {
  it("transforms Airtable method record to Method object", () => {
    const record = {
      id: "recMethod123",
      fields: {
        [METHOD_FIELDS.name]: "Breathing Exercise",
        [METHOD_FIELDS.duration]: 10,
        [METHOD_FIELDS.description]: "Deep breathing technique",
        [METHOD_FIELDS.experienceLevel]: ["recBeginner"],
        [METHOD_FIELDS.optimalFrequency]: ["Dagelijks", "Wekelijks"],
        [METHOD_FIELDS.linkedGoals]: ["recGoal1", "recGoal2"],
        [METHOD_FIELDS.photo]: [
          {
            url: "https://example.com/photo.jpg",
            thumbnails: { large: { url: "https://example.com/photo-large.jpg" } },
          },
        ],
        [METHOD_FIELDS.media]: ["recMedia1"],
      },
    }

    const result = transformMethod(record)

    expect(result).toEqual({
      id: "recMethod123",
      name: "Breathing Exercise",
      duration: 10,
      description: "Deep breathing technique",
      experienceLevelIds: ["recBeginner"],
      optimalFrequency: ["Dagelijks", "Wekelijks"],
      linkedGoalIds: ["recGoal1", "recGoal2"],
      photo: "https://example.com/photo-large.jpg",
      media: ["recMedia1"],
    })
  })

  it("uses direct URL when thumbnail is not available", () => {
    const record = {
      id: "recMethod456",
      fields: {
        [METHOD_FIELDS.name]: "Meditation",
        [METHOD_FIELDS.photo]: [{ url: "https://example.com/direct.jpg" }],
      },
    }

    const result = transformMethod(record)

    expect(result.photo).toBe("https://example.com/direct.jpg")
  })

  it("defaults empty arrays and zero duration", () => {
    const record = {
      id: "recMethod789",
      fields: {
        [METHOD_FIELDS.name]: "Simple Method",
      },
    }

    const result = transformMethod(record)

    expect(result.duration).toBe(0)
    expect(result.experienceLevelIds).toEqual([])
    expect(result.optimalFrequency).toEqual([])
    expect(result.linkedGoalIds).toEqual([])
    expect(result.media).toEqual([])
  })
})

describe("transformExperienceLevel", () => {
  it("transforms Airtable experience level record", () => {
    const record = {
      id: "recExpLevel123",
      fields: {
        [EXPERIENCE_LEVEL_FIELDS.name]: "Beginner",
        [EXPERIENCE_LEVEL_FIELDS.notes]: "For users new to mental fitness",
      },
    }

    const result = transformExperienceLevel(record)

    expect(result).toEqual({
      id: "recExpLevel123",
      name: "Beginner",
      notes: "For users new to mental fitness",
    })
  })
})

describe("transformMedia", () => {
  it("transforms Airtable media record to Media object", () => {
    const record = {
      id: "recMedia123",
      fields: {
        [MEDIA_FIELDS.filename]: "meditation-video.mp4",
        [MEDIA_FIELDS.type]: "video",
        [MEDIA_FIELDS.file]: [{ url: "https://example.com/video.mp4" }],
      },
    }

    const result = transformMedia(record)

    expect(result).toEqual({
      id: "recMedia123",
      filename: "meditation-video.mp4",
      type: "video",
      url: "https://example.com/video.mp4",
    })
  })

  it("handles missing file attachment", () => {
    const record = {
      id: "recMedia456",
      fields: {
        [MEDIA_FIELDS.filename]: "audio.mp3",
        [MEDIA_FIELDS.type]: "audio",
      },
    }

    const result = transformMedia(record)

    expect(result.url).toBeUndefined()
  })
})

describe("transformDay", () => {
  it("transforms Airtable day record to Day object", () => {
    const record = {
      id: "recDay123",
      fields: {
        [DAY_FIELDS.name]: "Maandag",
      },
    }

    const result = transformDay(record)

    expect(result).toEqual({
      id: "recDay123",
      name: "Maandag",
    })
  })
})

describe("transformMethodUsage", () => {
  it("transforms Airtable method usage record", () => {
    const record = {
      id: "recUsage123",
      fields: {
        [METHOD_USAGE_FIELDS.user]: ["recUser1"],
        [METHOD_USAGE_FIELDS.method]: ["recMethod1"],
        [METHOD_USAGE_FIELDS.methodName]: ["Breathing Exercise"],
        [METHOD_USAGE_FIELDS.program]: ["recProgram1"],
        [METHOD_USAGE_FIELDS.programmaplanning]: ["recPlanning1"],
        [METHOD_USAGE_FIELDS.usedAt]: "2024-06-15",
        [METHOD_USAGE_FIELDS.remark]: "Felt relaxed after",
      },
    }

    const result = transformMethodUsage(record)

    expect(result).toEqual({
      id: "recUsage123",
      userId: "recUser1",
      methodId: "recMethod1",
      methodName: "Breathing Exercise",
      programId: "recProgram1",
      programmaplanningId: "recPlanning1",
      usedAt: "2024-06-15",
      remark: "Felt relaxed after",
    })
  })

  it("handles missing linked records", () => {
    const record = {
      id: "recUsage456",
      fields: {},
    }

    const result = transformMethodUsage(record)

    expect(result.userId).toBeUndefined()
    expect(result.methodId).toBeUndefined()
  })
})

describe("transformProgramPrompt", () => {
  it("transforms Airtable program prompt record", () => {
    const record = {
      id: "recPrompt123",
      fields: {
        [PROGRAM_PROMPT_FIELDS.name]: "Stress Reduction Prompt",
        [PROGRAM_PROMPT_FIELDS.prompt]: "Create a program for stress reduction...",
        [PROGRAM_PROMPT_FIELDS.goals]: ["recGoal1"],
        [PROGRAM_PROMPT_FIELDS.promptType]: "Programmaopbouw",
      },
    }

    const result = transformProgramPrompt(record)

    expect(result).toEqual({
      id: "recPrompt123",
      name: "Stress Reduction Prompt",
      prompt: "Create a program for stress reduction...",
      goals: ["recGoal1"],
      promptType: "Programmaopbouw",
    })
  })

  it("defaults empty array for missing goals", () => {
    const record = {
      id: "recPrompt456",
      fields: {
        [PROGRAM_PROMPT_FIELDS.name]: "System Prompt",
        [PROGRAM_PROMPT_FIELDS.promptType]: "Systeem",
      },
    }

    const result = transformProgramPrompt(record)

    expect(result.goals).toEqual([])
  })
})

describe("transformProgrammaplanning", () => {
  it("transforms Airtable programmaplanning record", () => {
    const record = {
      id: "recPlanning123",
      fields: {
        [PROGRAMMAPLANNING_FIELDS.planningId]: "PLAN-001",
        [PROGRAMMAPLANNING_FIELDS.program]: ["recProgram1"],
        [PROGRAMMAPLANNING_FIELDS.date]: "2024-06-15",
        [PROGRAMMAPLANNING_FIELDS.dayOfWeek]: ["recMon"],
        [PROGRAMMAPLANNING_FIELDS.sessionDescription]: "Morning meditation session",
        [PROGRAMMAPLANNING_FIELDS.methods]: ["recMethod1", "recMethod2"],
        [PROGRAMMAPLANNING_FIELDS.goals]: ["recGoal1"],
        [PROGRAMMAPLANNING_FIELDS.methodUsage]: ["recUsage1"],
        [PROGRAMMAPLANNING_FIELDS.notes]: "Session notes",
      },
    }

    const result = transformProgrammaplanning(record)

    expect(result).toEqual({
      id: "recPlanning123",
      planningId: "PLAN-001",
      programId: "recProgram1",
      date: "2024-06-15",
      dayOfWeekId: "recMon",
      sessionDescription: "Morning meditation session",
      methodIds: ["recMethod1", "recMethod2"],
      goalIds: ["recGoal1"],
      methodUsageIds: ["recUsage1"],
      isCompleted: true,
      notes: "Session notes",
    })
  })

  it("marks session as completed when methodUsage exists", () => {
    const record = {
      id: "recPlanning456",
      fields: {
        [PROGRAMMAPLANNING_FIELDS.methodUsage]: ["recUsage1"],
      },
    }

    const result = transformProgrammaplanning(record)

    expect(result.isCompleted).toBe(true)
    expect(result.methodUsageIds).toEqual(["recUsage1"])
  })

  it("marks session as not completed when no methodUsage", () => {
    const record = {
      id: "recPlanning789",
      fields: {
        [PROGRAMMAPLANNING_FIELDS.date]: "2024-06-20",
      },
    }

    const result = transformProgrammaplanning(record)

    expect(result.isCompleted).toBe(false)
    expect(result.methodUsageIds).toEqual([])
  })

  it("defaults empty arrays for missing linked fields", () => {
    const record = {
      id: "recPlanningEmpty",
      fields: {},
    }

    const result = transformProgrammaplanning(record)

    expect(result.methodIds).toEqual([])
    expect(result.goalIds).toEqual([])
    expect(result.methodUsageIds).toEqual([])
    expect(result.isCompleted).toBe(false)
  })
})
