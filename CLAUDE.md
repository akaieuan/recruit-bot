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

**2. Nothing is sent without him saying so, and files are never attached.**

The tool fills text fields. It does not attach files and it does not press
submit.

Fetching a file into a form from script is the part that reads as automation
to an ATS, and the account it would cost is his. Attaching is off by default
and a test pins it that way. Both files sit ready: the resume where
`data/config.json` points, the cover letter written into the shared cover
folder. The two uploads and the submit are his clicks.

`pnpm cli apply <postingId>` assembles everything first: the resume, the
rendered cover letter, and a value for every field it can resolve. Then, in a
session with the browser, you fill the live form and upload the files. Then you
**stop, show him what is in the form, and wait.** He presses submit, or tells
you to.

One confirmation per application, not per field. The point is that he is never
surprised by something going out under his name, while still not retyping his
own phone number forty times.

Three things are never auto-answered, regardless:
- **Compensation expectations.** A negotiating position, not a form field.
- **Demographic and self-identification questions.** His to answer or decline.
- **Any field with no honest value.** A missing phone number is reported as a
  gap. It is never filled with something plausible.

## Voice

Full rules in `data/voice.md`. The ones that get broken most:

- **No em dashes.** Anywhere, in any drafted deliverable. Commas, colons,
  periods, parentheses. (Chat replies are exempt.)
- No LinkedIn vocabulary: "passionate about", "results-driven", "proven track
  record", "excited to leverage", "fast-paced environment".
- No "X is a Y wearing Z's clothes" metaphors. Say the plain thing.
- Lead with concrete work, not adjectives. Numbers do the work: 42 server
  components under 1KB, 30s to 1s, 19 primitives across 6 npm packages.
- **Lead with what he built and who used it, not with commit counts.** The
  resume never mentions 1,038 commits. It is true and it is in the library,
  but it is a supporting detail, and opening on it argues effort rather than
  judgement. `data/resume.pdf` is the document employers actually read: match
  its framing before reaching for anything else.
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

- Pressing submit on his behalf without him saying so for that application.
- LinkedIn scraping or automated activity. Their ToS forbids it and account
  restriction is a real outcome. The ATS APIs already provide discovery with no
  auth. Reading his own tracker in his own logged-in browser, with him present,
  is fine; background polling of LinkedIn is not.
- Inbox parsing (a later addition, not built)

## Applying

```bash
pnpm cli apply <postingId>     # what will be filled, and what is still missing
```

It refuses to call itself ready while anything required is unresolved. Resolve
those first: usually an unapproved cover letter, an undrafted answer, or a
value missing from `data/profile.json`.

When it is ready, open `applyUrl` in the browser, fill from the plan, upload
the files, then stop and show him. He sends it.

Ashby does not publish an application form schema, so its fields are read from
the live page; Greenhouse's come from `?questions=true` and are known upfront.

### Uploads are his, on purpose

`pnpm cli apply <id> --payload` writes one script that fills every text field
in a single execution. Run it in the tab, read the report it leaves on
`window.__recruitbot`, and hand him the tab. He attaches the two files and
submits.

This is a decision, not a limitation. Doing it any other way risks the
LinkedIn and ATS accounts the whole search runs on.

Then `pnpm cli record <id>` writes the tracker row, the follow-up date and the
posting stage in one step, after he has actually sent it.
