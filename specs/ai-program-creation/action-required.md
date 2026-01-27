# Action Required: AI-Assisted Program Creation Flow

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [x] **Get Airtable field IDs for Program Prompts table** - Retrieved via Airtable Meta API: name=fld54jyMhPH0Cesl7, goals=fldDo7u9EeWNyXENj, prompt=fld7nmlwZoO2QFqMj

- [x] **Verify OPENAI_API_KEY is available** - Ensure you have an OpenAI API key with access to GPT-4o model.

## During Implementation

- [x] **Add OPENAI_API_KEY to .env.local** - Set the key locally for development testing.

## After Implementation

- [ ] **Add OPENAI_API_KEY to Vercel environment variables** - Go to Vercel dashboard > Project Settings > Environment Variables and add OPENAI_API_KEY for production deployment.

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
