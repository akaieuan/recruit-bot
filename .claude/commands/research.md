---
description: Research scored postings so drafts can be specific rather than generic
---

Research the postings that cleared scoring.

```bash
pnpm cli queue research --limit ${1:-5}
```

Read every file in `data/work/research/pending/`. For each, write
`data/work/research/results/<same-id>.json`.

This is the step most worth spending on. A letter is specific or it is generic,
and the difference is made here, not at drafting time.

## What to find

1. **What the company actually builds.** Not the tagline. The product, who uses
   it, and what it does for them.
2. **Funding and headcount.** With a source. If you cannot find it, say so
   rather than estimating.
3. **The specific hard problem in their domain.** The thing that is genuinely
   difficult about building this product for these users. This is what he will
   argue about, so it needs to be real rather than flattering. A good hard
   problem is one their engineers would nod at.
4. **Two or three lines from the job description** that map to something in
   `data/facts.json`, with the fact ids that answer them.

Use WebSearch and WebFetch. Record every URL you relied on in `sources`. A
claim without a source is a claim someone will ask him about in an interview.

## Mapping JD lines to facts

Read `data/facts.json` first. `jd_lines` is the spine of the letter: each entry
pairs a line he should answer with the fact ids that answer it. Only use ids
that exist in the library. If a JD line has no honest answer in the library,
leave it out rather than reaching.

## Result shape

```json
{
  "posting_id": 1042,
  "company_summary": "What they build and for whom, in two or three sentences.",
  "funding": "Series A, $15M led by ... (source in sources)",
  "headcount": "~35",
  "hard_problem": "The genuinely difficult thing about this product, stated plainly.",
  "jd_lines": [
    {
      "jd_line": "Exact sentence quoted from the posting.",
      "fact_ids": ["ubik.built-live-agent-status", "oss.hitl-kit"]
    }
  ],
  "sources": ["https://...", "https://..."],
  "raw_md": "Anything else worth keeping for the drafting step."
}
```

Then:

```bash
pnpm cli submit research --dir
```

Report what you found, and flag anything that changes the picture: a company
much larger than the score assumed, a product that turned out not to have a
human-review surface, a recent layoff or a wind-down.
