---
description: Critique drafts before they reach review, weakest part first
---

Critique the drafts waiting for review.

```bash
pnpm cli queue critique --limit ${1:-5}
```

**Run this in a fresh session rather than straight after `/draft`.** A drafter
critiquing its own work grades the intent it had; a reader with no memory of
writing it grades what is on the page. That difference is the whole value of
this step.

Read each packet in `data/work/critique/pending/` and write
`data/work/critique/results/<same-id>.json`.

## What to look for

**Weakest part first.** He wants to be told what is worst about the draft, in
one sentence, before anything else. Flattery wastes his time and he will
discard the whole critique because of it. Do not open with what works.

Then check, in order:

1. **Claims that outrun the facts.** Cross-check the body against `facts_used`
   in the packet, which carries each fact's real text. Anything asserted that
   the facts do not support goes in `stretches`, quoted. This is the highest
   value thing you do here.
2. **Anything needing verification** before he sends: a company detail from
   research that could be stale, a claim about their product, a number.
3. **Generic passages.** Any sentence that would survive being pasted into a
   letter for a different company is dead weight.
4. **Voice.** Em dashes, LinkedIn vocabulary, stacked metaphors, more than one
   argument competing for the same space, an opening that summarises him
   instead of making a claim, a closing that trails off.
5. **The ask.** Does the letter argue for something, or just describe him?

## Result shape

```json
{
  "draft_id": 87,
  "weakest": "One sentence naming the worst thing about this draft.",
  "stretches": [
    "\"quoted sentence\" implies X, but the fact library only supports Y."
  ],
  "needs_verification": [
    "Says they raised a Series B in March. Research cited a January source."
  ],
  "verdict": "revise"
}
```

`verdict` is `ship` or `revise`. `revise` does not reject anything: it flags
the draft for him. He decides, because that judgment is the point of the
review.

Then:

```bash
pnpm cli submit critique --dir
```

Report the drafts you would not send as-is and why, in one line each.
