# TODO - Mental Fitness App Development Roadmap

**Last Updated**: 2026-01-30 (Post-Friday Demo Analysis)
**Critical Deadline**: Multifarma Launch (March 2026) - ~4-6 weeks

---

## TIER 0: CRITICAL BUGS (Fix Immediately)

### 🔴 CB-1: Blue Screen After Program Creation
**Impact**: App crashes after core user flow
**User Report**: "Blue screen after creating program is a bug"
**Priority**: BLOCKER
**Owner**: [Speaker 1]
**Action**:
- Reproduce issue in program creation wizard
- Check error boundaries and console logs
- Fix crash and add proper error handling
- Test full program creation flow end-to-end

### 🔴 CB-2: Points Incorrectly Awarded Bug
**Impact**: Core gamification broken, erodes user trust
**User Report**: "Bug where points are incorrectly awarded"
**Priority**: CRITICAL
**Owner**: [Speaker 1]
**Action**:
- Identify specific scenario where points are miscalculated
- Review point award logic in method completion flow
- Add validation to prevent duplicate/incorrect awards
- Test with real user scenarios

### 🔴 CB-3: Program Progress Resets to 0% After Recalculation (Edge Case)
**Impact**: User loses all visible progress
**User Report**: "When recalculating program after completing future activity, progress incorrectly reset to 0%"
**Priority**: HIGH
**Owner**: [Speaker 1]
**Action**:
- Review progress calculation logic in edit-running-program feature
- Handle edge case: completed future-scheduled activities before schedule adjustment
- Add validation: preserve completion records when regenerating schedule
- Test: complete future activity → edit program → verify progress maintained

---

## TIER 1: MUST-HAVE (Pre-Launch Blockers)

### 🟠 M-1: Improve Onboarding and UX Clarity ⬆️ PROMOTED FROM TIER 2
**Impact**: New users feel lost, abandon app - LAUNCH BLOCKER
**User Report**: "Onboarding and interface unclear; 'today's activity' needs to be more prominent, buttons need more logical placement"
**Priority**: HIGH (First Impression)
**Owner**: [Speaker 1]
**Action**:
- Audit HomePage layout: make "Today's Activity" primary CTA
- Simplify navigation, reduce cognitive load
- Add onboarding tooltips/tutorial for first-time users
- Test with real users (pilot group from Prana)
- Consider wizard-style first launch experience

### 🟠 M-2: Replace Plus Icon with Checkmark for Completed Personal Goals
**Impact**: User confusion in core feature
**User Report**: "Plus icon (+) for checking off personal goal is confusing"
**Priority**: HIGH (UX clarity)
**Owner**: [Speaker 1]
**Action**:
- Change icon from `+` to checkmark (✓) in PersonalGoals component
- Update button styling to indicate "mark complete" vs "add new"
- Test accessibility (screen reader labels)

### 🟠 M-3: Improve Overlap Warning Text Clarity
**Impact**: Users may accidentally create conflicting programs
**User Report**: "Warning text for overlapping program needs to be clearer"
**Priority**: MEDIUM-HIGH
**Owner**: [Speaker 1]
**Action**:
- Review current warning message
- Rewrite with specific dates and program names
- Example: "You already have 'Stress Management' running from Jan 15 - Feb 28. You cannot start a new program until this one finishes or is marked complete."
- Add visual distinction (red alert box)

### 🟠 M-4: Fix Video Auto-Fullscreen on Mobile
**Impact**: Poor user experience during method execution
**User Report**: "Videos on mobile auto-fullscreen, closing is cumbersome"
**Priority**: MEDIUM-HIGH
**Owner**: [Speaker 1]
**Action**:
- Remove `playsinline` attribute or adjust video player config
- Test inline video playback on iOS and Android
- Ensure videos play within page without forcing fullscreen
- Add clear close/back button if needed

### 🟠 M-5: Improve AI Method Selection Control 🚫 BLOCKED BY C-1
**Impact**: Random/irrelevant methods erode AI credibility
**User Report**: "AI chooses random methods if data isn't 'cleaned up'"
**Priority**: HIGH (Product Quality) - **BLOCKED until content audit completes**
**Owner**: [Speaker 1]
**Action**:
- Review AI prompt logic in program creation
- Add validation: only select methods with proper goal linkage
- Filter out incomplete/test data from AI selection pool
- Test with production-ready content only
- **⚠️ BLOCKED BY**: C-1 (Content Audit) - Cannot fix until data is clean

### 🟠 M-6: Fix Total Training Time Calculation 🚫 BLOCKED BY C-1
**Impact**: Misleading program duration information
**User Report**: "Total training time calculation not accurate (method durations randomly composed)"
**Priority**: MEDIUM - **BLOCKED until content audit completes**
**Owner**: [Speaker 1]
**Action**:
- Audit Airtable method duration data
- Verify duration field is populated for all active methods
- Update program creation logic to sum actual durations
- Display realistic time estimates to users
- **⚠️ BLOCKED BY**: C-1 (Content Audit) - Content team must provide accurate durations first

---

## TIER 2: SHOULD-HAVE (Launch Quality Items)

### 🟡 S-1: Implement AI-Generated Program Names
**Impact**: Better UX, less user friction
**User Report**: "Program naming not finalized, possibly AI-generated names"
**Priority**: MEDIUM
**Owner**: [Speaker 1]
**Scope Note**: Nice feature but not essential. Users can manually rename.
**Action**:
- Add AI prompt to generate program name based on goals + duration
- Example: "4-Week Stress Management & Focus Program"
- Allow user to edit before saving
- Test name quality with real scenarios

### 🟡 S-2: Add 'Add to My Program' Button in Library
**Impact**: Improves content discovery and program customization
**User Report**: "Users can't add method directly from library to their program"
**Priority**: MEDIUM
**Owner**: [Speaker 1]
**Scope Concern**: Requires integration with Edit Running Program feature. Useful but not launch-critical.
**Action**:
- Add button to MethodDetail page in library
- Trigger "Add to active program" flow
- Handle case: no active program (show message)
- Regenerate schedule with new method
- Test edge cases (program full, method already included)

### 🟡 S-3: PWA Re-login After Homescreen Install ⬇️ MOVED FROM TIER 1
**Impact**: Poor first-use experience, user frustration
**User Report**: "After PWA homescreen install, user must log in again"
**Priority**: MEDIUM (Known PWA limitation - may be unfixable)
**Owner**: [Speaker 1]
**Scope Note**: This is a PWA architecture limitation. Research max 1 day, then document workaround.
**Action**:
- Research service worker session persistence (1 day max)
- Test if httpOnly cookies survive PWA installation
- If unfixable: add clear messaging during install flow ("You'll need to log in once after installing")
- Document workaround in onboarding
- **Do NOT spend more than 1 day on this**

### 🟡 S-4: Library Filter by Goal and Duration
**Impact**: Better content discoverability
**User Report**: "Filter function in library based on goal and duration"
**Status**: Already implemented?
**Action**:
- Verify filter is working correctly
- Test with production content
- If missing, implement dual-filter UI (goal + duration sliders)

### 🟡 S-5: Add Method Images/Photos
**Impact**: Visual appeal, user engagement
**User Report**: "Add nice images/photos for each method"
**Priority**: MEDIUM (Polish)
**Owner**: Content Team
**Action**:
- Source/create images for each method
- Upload to Airtable attachment field
- Update UI to display method images in library and program view
- Ensure images work offline (PWA cache)

---

## TIER 3: NICE-TO-HAVE (Post-Launch Polish)

### 🟢 N-1: Implement User Levels (Beginner/Advanced)
**Impact**: Personalization, potential for tiered content
**User Report**: "Distinction between 'beginner' and 'advanced' not yet implemented"
**Priority**: LOW (Future iteration)
**Scope Concern**: This adds complexity. Defer until content strategy is clear.
**Action**:
- Define criteria for level progression (# exercises completed? time active?)
- Design level-based filtering in method library
- Add level indicator to user profile
- **Defer to v2.0**

### 🟢 N-2: Score Reset After 3 Months Inactivity (with Warnings)
**Impact**: Reinforces habit-building philosophy
**User Report**: Already documented as product decision
**Priority**: LOW (Not launch-critical)
**Action**:
- Implement cron job or API check for user inactivity
- Send warning emails at 2 months, 2.5 months
- Display in-app warning banner
- Reset Mental Fitness score to 0 at 3-month mark
- **Defer to post-launch**

### 🟢 N-3: PWA Update Issues (Service Worker)
**Impact**: Users don't get latest features
**User Report**: "PWA updates not always immediately pushed to homescreen"
**Priority**: LOW (Technical debt)
**Scope Concern**: This is a known PWA limitation. Document workaround for now.
**Action**:
- Review service worker caching strategy
- Implement update notification prompt
- Add "Check for Updates" button in settings
- **Defer to technical debt sprint**

---

## TIER 4: CONTENT & BUSINESS (Non-Technical)

### 📋 C-1: Content Audit and Completion [URGENT]
**Impact**: BLOCKS all AI features, method quality, launch readiness
**User Report**: "Crucial content (goals, exercises, audio/video) not fully filled in"
**Priority**: CRITICAL BLOCKER
**Owner**: Content Team (Iris, Speaker 5)
**Deadline**: February 7 (Week 1 of Feb)
**Action**:
- **Schedule content planning meeting ASAP** (no date set - RED FLAG)
- Define complete list of methods/exercises for MVP
- Fill in all Airtable fields: duration, goal linkage, media files
- Ensure AI prompt data is accurate for each method
- Clean up test/incomplete data
- **Use AI to extract suggestions from recorded sessions** (Speaker 5)
- Deliverable: Production-ready content in Airtable by Feb 7

### 📋 C-2: Decide on Program Naming Strategy
**Impact**: Affects UX and AI implementation
**User Report**: "Program naming not finalized"
**Priority**: MEDIUM
**Owner**: Product Team
**Action**:
- Decide: AI-generated vs user-created vs hybrid
- Document decision
- Implement accordingly (see S-1)

### 📋 C-3: Define Commercial Model and Access Duration
**Impact**: Affects billing, user communications, product roadmap
**User Report**: Multiple access models discussed (lifetime for National Bank, 1-year for others, B2C subscription)
**Priority**: MEDIUM (Business decision)
**Owner**: Speaker 3, Speaker 2
**Scope Concern**: This is strategic, not tactical. Should not block development.
**Action**:
- Decide: Standard access duration (suggestion: 1 year)
- Document exception process for custom clients (e.g., National Bank)
- Define B2C pricing if/when product goes to market (€10-20/month suggested)
- Communicate to dev team if access duration affects app logic

### 📋 C-4: Finalize Multilingual Strategy
**Impact**: Limits addressable market
**User Report**: "App technically supports NL, FR, EN, but English translation and audio not available"
**Priority**: LOW (Post-launch)
**Owner**: Content Team
**Action**:
- Focus on Dutch for Multifarma launch
- Plan translation and audio recording for Q2 2026
- **Defer until basic functionality is done** (per Speaker 1)

---

## TIER 5: FUTURE / DEFERRED (Post-v1.0)

### 🔮 F-1: HR Dashboard for B2B Clients
**Impact**: Differentiator for corporate sales
**User Report**: "Develop HR dashboard showing anonymized team data"
**Priority**: LOW (Future feature)
**Scope Concern**: This is a separate product. Defer to v2.0 or later.
**Action**:
- Define requirements: anonymized login data, progress tracking
- Ensure user privacy (no personal goals visible)
- Build admin portal with read-only analytics
- **Target: Q3 2026 or later**

### 🔮 F-2: Evolve PWA to Native App (Play Store/App Store)
**Impact**: Better performance, wider distribution
**User Report**: "Investigate evolving to full standalone app, possibly with own database"
**Priority**: LOW (Strategic)
**Scope Concern**: Major architectural change. Requires cost/benefit analysis.
**Action**:
- Evaluate PWA limitations vs native benefits
- Assess database migration (Airtable → PostgreSQL/Firebase)
- Cost analysis (development, maintenance, app store fees)
- Decision: Keep as PWA or rebuild as native
- **Defer to 2026 Q4 strategic planning**

### 🔮 F-3: Mental Coach Integration
**Impact**: Cross-sell opportunity
**User Report**: "Integrate existing Mental Coach app"
**Priority**: LOW
**Action**:
- Define integration scope (shared login? embedded content?)
- **Defer to product roadmap discussion**

### 🔮 F-4: AI-Driven Limiting Belief Identification
**Impact**: Advanced personalization
**User Report**: "AI identifies underlying limiting beliefs, adds as exercises"
**Priority**: LOW (Innovation)
**Scope Concern**: Very complex, requires psychological validation. Not MVP material.
**Action**:
- Research feasibility and ethical considerations
- **Defer to v3.0 or innovation sprint**

### 🔮 F-5: Baseline Measurement (Nulmeting) During Onboarding
**Impact**: Enables progress tracking over time
**User Report**: Discussed as future feature
**Priority**: MEDIUM (Post-launch)
**Action**:
- Design measurement questionnaire (validated scales)
- Build scoring logic
- Display results in user profile
- **Target: Q2 2026**

### 🔮 F-6: B2C Product Launch
**Impact**: New revenue stream
**User Report**: "Sell app to individuals if successful"
**Priority**: LOW (Business development)
**Action**:
- Validate product-market fit with corporate pilot
- Build payment infrastructure (Stripe, subscriptions)
- Marketing strategy
- **Target: 2027**

---

## TESTING & LAUNCH PREPARATION

### 🧪 T-1: Add Test Users to Database
**Priority**: HIGH
**Owner**: Speaker 3, Speaker 1
**Action**:
- Add Dominique, Geert, and other stakeholders to Airtable
- Provide test credentials
- Share test link
- **Deadline**: This week

### 🧪 T-2: Pilot Testing with Prana Client
**Priority**: HIGH
**Owner**: Team
**Action**:
- Select small engaged group from Prana
- Onboard pilot users
- Collect structured feedback
- Iterate based on learnings
- **Timeline**: February 2026

### 🧪 T-3: Pre-Launch QA Testing
**Priority**: CRITICAL
**Owner**: Speaker 1, Speaker 3, Speaker 5
**Action**:
- Test all critical flows end-to-end
- Device testing (iOS, Android, desktop)
- Performance testing (slow connections)
- Offline capability testing
- Bug bash session before Multifarma launch
- **Deadline**: Late February 2026

---

## SCOPE CREEP ALERTS 🚨

The following items from the Friday Demo feedback are flagged as **potential scope creep** that could jeopardize the March launch:

1. **AI-Generated Program Names** (S-1): Nice-to-have, not essential. Users can name manually.
2. **User Levels (Beginner/Advanced)** (N-1): Adds complexity without clear ROI. Defer.
3. **Add Method from Library to Program** (S-2): Useful but not launch-critical. Consider for v1.1.
4. **Score Reset After 3 Months** (N-2): Good concept but adds cron jobs, email logic. Defer to post-launch.
5. **HR Dashboard** (F-1): Completely separate product. Do not start before v1.0 ships.
6. **Native App Migration** (F-2): Massive undertaking. Premature optimization.
7. **Multiple Active Programs**: User Report asks "whether users can have multiple programs" - this was explicitly decided as NO (one-active-program-limit). Do not reopen.

**Product Owner Recommendation**: Focus on TIER 0 (Critical Bugs) and TIER 1 (Must-Have) to meet Multifarma deadline. TIER 2 (Should-Have) can be triaged based on available time. Everything else defers to post-launch.

---

## DECISION LOG (Recent Product Decisions)

### ✅ Confirmed Decisions
- **One Active Program Only**: Implemented and validated
- **3-Score Split Display**: Mental Fitness, Personal Goals, Good Habits (completed)
- **Cumulative Scoring**: Total score persists across programs (already working)
- **Program Status Field**: Actief/Gepland/Afgewerkt (completed)
- **Password Login**: Fixed today (commit a1607de)
- **Edit Running Program**: Completed with schedule regeneration
- **Personal Goals Score Bug**: Fixed (was using field ID instead of name)

### ⏳ Open Decisions Requiring Stakeholder Input
- **Program Naming Strategy**: AI vs manual vs hybrid (see C-2)
- **Commercial Model**: Access duration, pricing tiers (see C-3)
- **User Level Criteria**: What triggers beginner→advanced? (deferred to v2.0)
- **Content Finalization**: Which methods make MVP cut? (URGENT - see C-1)

---

## TIMELINE SNAPSHOT (Path to March Launch)

**Week of Jan 30 (NOW)**:
- Fix critical bugs (CB-1, CB-2, CB-3)
- Add test users (T-1)
- Schedule content meeting (C-1)

**Week of Feb 7**:
- Complete TIER 1 must-haves (M-1 through M-6)
- Content team delivers production-ready Airtable data (C-1)
- Begin pilot testing with Prana (T-2)

**Week of Feb 14**:
- Complete TIER 2 should-haves (triage based on progress)
- Ongoing pilot testing and iteration
- Prepare Multifarma onboarding materials

**Week of Feb 21**:
- Final QA testing (T-3)
- Bug bash session
- Performance optimization
- Documentation and training materials

**Week of Feb 28 / Early March**:
- Multifarma launch readiness
- Final deployment to production
- Launch support and monitoring

---

## KEY FILES & REFERENCES

### Recent Completed Features (Specs)
- `/Users/renaatdevos/Code/Prana/corporate-mental-fitness-program/specs/edit-running-program/`
- `/Users/renaatdevos/Code/Prana/corporate-mental-fitness-program/specs/one-active-program-limit/`
- `/Users/renaatdevos/Code/Prana/corporate-mental-fitness-program/specs/score-split-display/`
- `/Users/renaatdevos/Code/Prana/corporate-mental-fitness-program/specs/personal-goals/`

### Critical Codebase Locations
- Score Widgets: `src/components/ScoreWidgets.tsx`
- Homepage: `src/pages/HomePage.tsx`
- Program Creation: `src/pages/ProgramCreation.tsx`
- Airtable Field Mappings: `api/_lib/field-mappings.js`
- User API: `api/users/`
- Program API: `api/programs/`

### Airtable Field IDs (Key)
- Mental Fitness Score: `fldMTUjMC2vcY0HWA`
- Personal Goals Score: `fldVDpa3GOFSWTYly`
- Good Habits Score: `fldpW5r0j9aHREqaK`
- Program Status: `fldJcgvXDr2LDin14`

---

**END OF TODO.md**
