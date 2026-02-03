# Functional Ideas Backlog

Ideas that are parked for future consideration. Not planned for current sprint.

---

## F-3: Deduplicate Method Usage Points
**Parked**: 2026-02-03
**Decision**: Keep current behavior (Option A)

**Current state**: Each method_usage record awards 10 points. Using the same method multiple times gives multiple points.

**Why parked**: This is intentional - completing a method multiple times (on different days/sessions) should be rewarded as it represents continued practice.

**Future considerations**:
- Consider daily caps if point inflation becomes an issue
- Session-based deduplication could be added if users exploit repeated usages
- See `/specs/method-usage-points/` for implementation options if needed

**Documentation**: Full technical analysis in `/specs/method-usage-points/`

---

## Template

### F-X: [Idea Name]
**Parked**: [Date]
**Reason**: [Why this is deferred]

**Description**: [What the feature would do]

**Considerations**: [Any notes for future implementation]
