---
description: Draft cover letters and application answers from the fact library
---

Draft for the postings that have been researched.

```bash
pnpm cli queue draft --limit ${1:-3}
```

Read `data/facts.json` and `data/voice.md` before you write anything. Skim one
letter in `data/corpus/` to hear the register. Then read each packet in
`data/work/draft/pending/` and write `data/work/draft/results/<same-id>.json`.

## The rule that governs this step

Every claim traces to a fact id. If something you want to say is not in
`data/facts.json`, either do not say it or ask him. Do not estimate a number,
do not upgrade "design partners in academia, biotech, and law" into named
customers, do not turn "demoed to well over a hundred teachers" into a
different number. The validator will catch the obvious cases and refuse the
submission; it will not catch a plausible-sounding overclaim, which is why this
is your job and not the validator's.

The `gaps` array in the fact library is the never-claim list. If the posting
asks for something on it, do not address it at all. Close forward on what he
would want to own instead. **Do not write a "where I do not match" paragraph.**
He retired that. Gaps get handled in the interview.

## The cover letter

Opens: `I am applying for the [role] role at [company].`

Then three to five paragraphs. What makes a letter good here:

- Open the second paragraph with a claim or a specific artifact, not a summary
  of himself.
- One strong opinion, argued rather than asserted.
- Concrete numbers doing the work of adjectives.
- Honest about limits in a way that increases credibility.
- A closing line that lands.

Close with Brooklyn, the office cadence, and links.

Ends: `Ieuan King`

Pick **one** recurring argument that fits the domain, and do not stack them.
They are in `data/voice.md` under "Recurring moves that work": the rubber
stamp, the tester who never opened a source, the failure mode, states first,
the constraint layer, the motion rule, the cheap fix he refused, watch don't
ask, the AI position, prototype honesty.

If the packet's role is an engineering req, set `contact_variant` to
`engineering` so the contact line carries GitHub rather than LinkedIn.

Target 35 to 40 lines. The validator measures the real render and refuses
anything that runs onto a second page.

## Application answers

If the packet has `application_questions`, write one draft per question with
`kind: "answer"` and the question's `key` as `question_key`. Answers are not
page-limited but should be tight: two or three short paragraphs unless the
question asks for more.

## Revisions

If the packet has a `revising` array, this is a second pass. Read
`review_note`, read `previous_body`, and address what the note asked for. Do
not rewrite from scratch: the parts he did not object to are the parts that
worked.

## Result shape

```json
{
  "posting_id": 1042,
  "drafts": [
    {
      "kind": "cover_letter",
      "contact_variant": "design",
      "body": "I am applying for the ... role at ...\n\n...\n\nIeuan King",
      "facts_used": ["ubik.1038-commits-three-years", "oss.hitl-kit"],
      "jd_lines": ["The JD line this answers"]
    },
    {
      "kind": "answer",
      "question_key": "question_12345",
      "body": "...",
      "facts_used": ["ubik.built-live-agent-status"]
    }
  ]
}
```

`allow_gaps` exists for the rare honest negation ("I have not shipped React
Native"). Use it only when naming the gap is the point of the sentence.

Then:

```bash
pnpm cli submit draft --dir
```

Rejections quote the offending line. Fix and resubmit.

Report which facts each draft leaned on and which JD lines they answer, so the
review is fast. Then run `/critique`.
