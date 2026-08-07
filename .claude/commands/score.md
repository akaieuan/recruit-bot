---
description: Score filtered postings against the targeting rules
---

Score the postings waiting in the queue.

```bash
pnpm cli queue score --limit ${1:-10}
```

Read every file in `data/work/score/pending/`. For each one, write
`data/work/score/results/<same-id>.json`.

## What you are judging

He is a design engineer, four years professional, in Brooklyn. He does product
design **and** ships production frontend, and that combination is the entire
positioning. The ideal req is **Design Engineer** or **Founding Designer** at a
5 to 60 person NYC company, seed to Series A, building an AI product where a
human reviews or approves agent output, as the first or second design hire.

The reasoning behind that: at a Product Designer req he competes against
designers with deeper portfolios and his frontend is a nice-to-have. At a
Frontend Engineer req he competes against engineers with deeper CS and his
design is a nice-to-have. Both make him argue on his weakest axis. Score for
where doing both is the requirement rather than a bonus.

## Scoring

| Field | Values |
|---|---|
| `score` | 0 to 100 |
| `tier` | `strong`, `possible`, `long_shot`, `reject` |
| `title_match` | `ideal` (design engineer / founding designer), `adjacent` (product designer, product engineer), `off` |
| `nyc` | `in_person`, `hybrid`, `remote_ok`, `not_nyc`, `unknown` |
| `recommendation` | `advance`, `hold`, `skip` |

Weigh, roughly in this order: title match, whether the product has a human
reviewing or approving model output, company size and stage, NYC and onsite
cadence (4 to 5 days in office is a **positive** signal, not a cost),
compensation against a $150k to $250k band, and JD language hits.

Language worth noticing: agent, human-in-the-loop, review, approval,
evaluation, design system, prototype in code, Claude Code, Cursor, shadcn,
Electron, founding, zero to one, craft. The packet lists the ones found
literally; you judge whether the JD means them.

Do not reject on years of experience. He is four years in. 3 to 8 is a clean
fit, 5 to 7 a normal stretch worth taking, 10+ a long shot worth surfacing
anyway. The packet flags these already.

`company_size_estimate` and `stage_estimate` come from what you know and may be
stale. Label them as estimates ("~40 (estimate)"). `/research` verifies before
any drafting effort is spent.

## Result shape

```json
{
  "posting_id": 1042,
  "score": 82,
  "tier": "strong",
  "title_match": "ideal",
  "keyword_hits": ["agent", "human-in-the-loop", "design system"],
  "company_size_estimate": "~40 (estimate)",
  "stage_estimate": "series-a",
  "nyc": "hybrid",
  "rationale": "Two or three sentences on why this scores where it does, naming the strongest and weakest signal.",
  "recommendation": "advance"
}
```

Then:

```bash
pnpm cli submit score --dir
```

If a file is rejected, the error names the field and the allowed values. Fix
that file and submit again.

Finish by running `pnpm cli status` and reporting: how many scored, which ones
came out `strong`, and anything that looked like a genuine outlier worth his
attention.
