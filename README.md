# recruit-bot

A semi-automated job application funnel. It polls ATS job boards, throws away
the roles that are off-target, researches the ones worth arguing for, and
writes first drafts in a specific voice against a fixed library of verified
facts.

A human reviews and sends. Nothing here fills in a form or clicks apply.

```
poll -> normalize -> filter -> score -> research -> draft -> review -> track
        (deterministic)      (Claude Code sessions)         (you)
```

## Why it is shaped this way

**Most volume dies for free.** The deterministic filter rejects on title and
location before a model sees anything. On the seeded boards it removes about
95% of what the APIs return, which means the expensive steps only ever run on
postings that could plausibly be worth an application.

**Nothing is invented.** Every claim in a generated letter has to name an id in
`data/facts.json`. An id that does not exist is a hard failure, not a warning,
and the "never claim" list from the same file is scanned for directly. The
validator is a backstop rather than the rule, but it means an overclaim cannot
reach a PDF by accident.

**The model never touches the database.** Scoring, research, drafting and
critique run in Claude Code sessions through a file protocol: the CLI writes
JSON work packets, the session writes result files, the CLI validates and
applies them. All SQL lives in one place, and a bad result is rejected with a
message specific enough to fix.

## Setup

Needs Node 22.5 or newer (it uses the built-in `node:sqlite`).

```bash
pnpm install
pnpm cli import source     # fact library, voice rules, corpus, tracker CSV
pnpm cli import csv        # seed the tracker
pnpm cli boards seed       # seeded boards, plus any found in the tracker URLs
```

## Daily use

```bash
pnpm cli poll              # fetch live postings
pnpm cli filter            # deterministic triage, no model involved
pnpm cli questions         # Greenhouse application form schemas
pnpm cli status            # what is waiting and what to run next
```

Then, in a Claude Code session in this directory:

```
/score        rank what survived the filter
/research     dig into the ones worth arguing for
/draft        write the cover letter and any application answers
/critique     read the drafts cold, weakest part first
```

And to review:

```bash
pnpm dev                   # http://localhost:3000
```

Three screens: the pipeline by stage, a posting detail with the draft, its
critique and the facts it rests on, and the tracker with day-7 follow-ups.

## Data sources

| Source | Auth | Notes |
|---|---|---|
| Ashby | none | Publishes typed salary components. Posting pages are JS-rendered, so the API is the only way to read a description. |
| Greenhouse | none | `?questions=true` returns the application form schema, which is how custom questions get drafted before the form is opened. |

LinkedIn is deliberately absent. There is no public jobs API, scraping violates
their terms, and account restriction is a real outcome. The ATS APIs already
provide discovery with no auth.

## Layout

```
src/lib/        pipeline: pollers, normalization, filter, validator, PDF, queue
src/cli/        the only writer to the database
src/app/        review UI
.claude/        the session commands
data/           everything personal. Gitignored, always.
```

`pnpm test` covers the rules worth protecting: what the filter rejects, what
the validator refuses, and whether the PDF still lands on the same baselines as
the letters already sent.
