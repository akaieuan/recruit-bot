# recruit-bot

A semi-automated job application funnel. It discovers postings, triages them,
researches the ones worth arguing for, and writes first drafts. A human reviews
and sends.

## Two rules that outrank everything else

**1. Never invent a fact about Ieuan.**

Every claim in generated copy traces to an entry in `data/facts.json`. If a
fact is not in the library, ask for it or leave it out. Never estimate, never
round up, never infer a number from context. This is the failure that matters
most here: an overclaim that reaches a founder is not a typo, it is a lie with
his name on it.

The library also carries a `gaps` list of things he does not do. Never claim
one, in any phrasing. The draft validator scans for them and refuses the
submission, but the validator is a backstop, not the rule.

**2. A generated application is a draft, never a submission.**

This tool never fills in a form, never clicks apply, never sends an email. It
produces a PDF and answer text for a human to read, edit, and submit. If you
find yourself reaching for a browser to complete an application, stop.

## Voice

Full rules in `data/voice.md`. The ones that get broken most:

- **No em dashes.** Anywhere, in any drafted deliverable. Commas, colons,
  periods, parentheses. (Chat replies are exempt.)
- No LinkedIn vocabulary: "passionate about", "results-driven", "proven track
  record", "excited to leverage", "fast-paced environment".
- No "X is a Y wearing Z's clothes" metaphors. Say the plain thing.
- Lead with concrete work, not adjectives. Numbers do the work: 1,038 commits,
  42 server components under 1KB, 30s to 1s.
- Declarative, clipped sentences. Short paragraphs. One strong opinion per
  piece, argued rather than asserted.
- A closing line that lands rather than trails off.
- **No gap paragraph.** He used to include a "where I do not match the posting"
  paragraph and killed it. Close forward on what he would want to own instead.
  Gaps are handled in the interview, not pre-emptively in writing.

`data/corpus/` holds his previous letters in plain text. Skim one before
drafting if you need to hear the register.

## How work happens here

The database is only ever touched through `pnpm cli`. Do not open
`data/recruit.db`, do not write SQL, do not hand-edit anything in `data/work/`
except the result files you are asked to write.

The loop for every model step is the same:

```bash
pnpm cli queue <step> --limit 10   # writes data/work/<step>/pending/<id>.json
# read each packet, do the thinking, write data/work/<step>/results/<id>.json
pnpm cli submit <step> --dir       # validates, applies, archives
```

If `submit` rejects a file it tells you exactly what is wrong and leaves the
file in place. Fix it and run submit again. A rejection is not a dead end.

Steps: `/score`, `/research`, `/draft`, `/critique`. Run `pnpm cli status` to
see what is waiting.

## Pipeline stages

```
new -> auto_rejected                     (deterministic filter, no model)
    -> needs_score -> scored             (hold)
                   -> skipped            (skip)
                   -> needs_research     (advance)
                   -> researched -> needs_draft -> in_review -> approved -> applied
```

`filter` is deterministic and rejects most volume before a model is involved.
Titles reject; compensation and years only ever flag.

## Layout

- `src/lib/` pipeline: pollers, normalization, filter, validator, PDF, queue
- `src/cli/` the only writer to the database
- `src/app/` the review UI (`pnpm dev`)
- `data/` everything personal. Gitignored, always. Never commit anything from
  here, never paste its contents into a commit message or a PR.

## Out of scope

- Submitting applications, filling forms, or automating a browser against a job site
- LinkedIn scraping or automation of any kind. Their ToS forbids it and account
  restriction is a real outcome. The ATS APIs already provide discovery with no auth.
- Inbox parsing (a later addition, not built)
