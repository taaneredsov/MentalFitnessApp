# Rewards System Redesign

**Date:** 2026-02-27
**Status:** Approved
**Scope:** Scoring, streaks, badges, levels, inactivity handling

## Context

The current rewards system has several gaps:
- Method usage doesn't award points at all
- Overtuiging (mindset) scores are orphaned from all score dimensions
- Airtable backend path doesn't persist score fields
- Silent failures in reward awarding mask bugs
- 90-day inactivity wipes all progress (too punitive for a wellness app)
- Badges reward grinding (count-based) instead of consistency
- Streak model is daily-based, misaligned with program schedules

## Design Principles

1. **Incentivize without stress** — rewards encourage consistency, not obsessive usage
2. **Program-aligned** — the program schedule is the heartbeat of engagement
3. **Journey-based** — badges reflect phases (starter → consistent → mastery), not raw counts
4. **Earned forever** — scores and badges never reset; only streaks reset on inactivity

---

## 1. Scoring Model

Three score dimensions displayed on the home page:

| Score | Source | Calculation |
|-|-|-|
| Mental Fitness | Completing methods | Sum of each method's `Punten waarde` field (1-10 pts) |
| Pers. Doelen | Completing personal goals | +5 per completion |
| Gewoontes | Logging good habits | +5 per habit log |

**Mindset (overtuigingen):** +1 bonus point added to total score (not a separate dimension).

**Total score** = Mental Fitness + Pers. Doelen + Gewoontes + bonus points (streaks, milestones, mindset)

### Key change: Variable method points
Methods no longer award a flat 10 points. Each method has a `Punten waarde` column in Airtable (field ID: `fldcyKMc8Q02H2QGN`), synced to `methods_pg.points_value` in Postgres. Values range 1-10 based on method intensity/duration.

---

## 2. Streak Model — Program-Aligned

**Previous:** Daily consecutive activity (miss 1 day = reset).

**New:** Streak counts consecutive scheduled sessions completed on time.

### How it works
- Each program has a schedule of planned sessions (Programmaplanning records)
- When a user completes a scheduled method on or before its scheduled date: streak +1
- If a scheduled session is missed (not completed by end of that day): streak resets to 0
- Non-program activities (habits, goals, mindset) do NOT affect streak
- Between programs (no active program): streak freezes, doesn't reset

### Streak bonuses
| Milestone | Bonus |
|-|-|
| 7 sessions streak | +25 pts |
| 21 sessions streak | +75 pts |
| Full program completed on time | +100 pts |

### Inactivity handling
- **Streak resets** on inactivity (no scheduled session completed)
- **Scores stay forever** — no more 90-day wipe
- **Badges stay forever** — earned is earned
- **Level stays** — based on total accumulated points

---

## 3. Badges — Journey-Based Progression

12 badges in 3 tiers reflecting the user's mental fitness journey.

### Tier 1: Eerste Stappen (Getting Started)

| Badge | ID | Trigger | Icon |
|-|-|-|-|
| Eerste Sessie | eerste_sessie | Complete 1st method | star |
| Eerste Streak | eerste_streak | 3 consecutive scheduled sessions | flame |
| Eerste Week | eerste_week | Complete all scheduled sessions in week 1 of a program | calendar-check |
| Goede Start | goede_start | Log 1st habit or personal goal | heart |

### Tier 2: Consistentie (Building Consistency)

| Badge | ID | Trigger | Icon |
|-|-|-|-|
| Op Dreef | op_dreef | 21-session streak | zap |
| Tweede Programma | tweede_programma | Start a 2nd program | refresh-cw |
| Drie Maanden | drie_maanden | Active for 3 calendar months | clock |
| Veelzijdig | veelzijdig | Used all 3 pillars (method + habit + goal) in one week | layers |

### Tier 3: Mentale Atleet (Long-term Mastery)

| Badge | ID | Trigger | Icon |
|-|-|-|-|
| Programma Voltooid | programma_voltooid | Complete a full program on schedule | trophy |
| Zes Maanden | zes_maanden | Active for 6 calendar months | shield |
| Jaar Actief | jaar_actief | Active for 12 calendar months | crown |
| Mentale Atleet | mentale_atleet | Reach level 8+ (1150 pts) | medal |

### Removed badges (become legacy)
- vijf_methodes, twintig_methodes (count-based grinding)
- kwart_programma, half_programma, driekwart_programma (replaced by streak)
- week_streak, twee_weken_streak, maand_streak (replaced by program-aligned streak)
- dagelijkse_held, week_gewoontes (daily habit completion — too stressful)

Legacy badges remain visible on user profiles but cannot be newly earned.

---

## 4. Level Progression

Recalibrated for ~1 year journey with variable method points.

| Level | Points | Title | ~Timeline |
|-|-|-|-|
| 1 | 0 | Beginner | Day 1 |
| 2 | 50 | Ontdekker | ~Week 2 |
| 3 | 125 | Beoefenaar | ~Month 1 |
| 4 | 250 | Doorzetter | ~Program 1 done |
| 5 | 400 | Gevorderde | ~Month 4 |
| 6 | 600 | Expert | ~Program 2 done |
| 7 | 850 | Kampioen | ~Month 8 |
| 8 | 1150 | Meester | ~Month 10 |
| 9 | 1500 | Legende | ~Month 12 |
| 10 | 2000 | Mentale Atleet | Sustained usage |

---

## 5. Migration Plan

### For existing users
- **Scores stay** — existing points preserved
- **Legacy badges kept** — old badges that no longer exist remain visible
- **Streaks reset to 0** — old daily streak doesn't translate to program-aligned; fresh start
- **Levels recalibrate** — users benefit from lower thresholds (e.g., 350 pts was Level 4, now Level 5)

### Data requirements
- New Postgres column: `methods_pg.points_value` (integer, synced from Airtable `Punten waarde`)
- New Postgres columns on users: `first_active_date` (timestamptz), `programs_started_count` (integer)
- Backfill existing methods with `Punten waarde` from Airtable
- Recalculate stored scores for all existing users based on new formulas

### Bug fixes included
1. Method usage now awards points (reads `points_value` from method record)
2. All usage handlers properly report award failures (no more silent catch)
3. Frontend optimistic updates for all score types
4. Remove 90-day score wipe
5. Overtuiging contributes +1 to total bonus
