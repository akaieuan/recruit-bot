---
description: Run the daily pipeline pass and report what needs attention
---

Refresh the funnel and report what is waiting.

```bash
pnpm cli poll
pnpm cli filter
pnpm cli questions
pnpm cli status
```

Then report, briefly:

- New postings that survived the deterministic filter, with company, title,
  compensation and location.
- Anything that closed since the last run.
- Follow-ups due today (`pnpm cli tracker followups`).
- What to run next: `/score`, `/research`, `/draft`, `/critique`, or open the
  review UI with `pnpm dev`.

Do not score or draft anything in this command. This is the sweep; the thinking
steps are separate so they can be run deliberately.
