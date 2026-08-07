import { readFacts } from '@/lib/facts'
import { Card, CardBody, CardHeader, CardTitle, Eyebrow } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

/**
 * The fact library, readable. Every claim in every draft has to trace to one
 * of these ids, so it is worth being able to see the whole list at a glance
 * and notice what is missing.
 */
export default function FactsPage() {
  const { facts, gaps, source, generated_at } = readFacts()

  const groups = new Map<string, typeof facts>()
  for (const fact of facts) {
    const prefix = fact.id.split('.')[0] ?? 'other'
    const list = groups.get(prefix) ?? []
    list.push(fact)
    groups.set(prefix, list)
  }

  const GROUP_LABEL: Record<string, string> = {
    bio: 'Who he is',
    ubik: 'Ubik',
    oss: 'Open source',
    research: 'Research',
    pre: 'Before software',
    stack: 'Stack',
  }

  return (
    <main className="mt-5">
      <p className="text-[12px] text-dim">
        {facts.length} facts and {gaps.length} things never to claim. Derived from {source} on{' '}
        {generated_at.slice(0, 10)}. Regenerate with{' '}
        <code className="font-mono text-dim2">pnpm cli import source</code>.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {[...groups.entries()].map(([prefix, list]) => (
            <Card key={prefix}>
              <CardHeader>
                <CardTitle>{GROUP_LABEL[prefix] ?? prefix}</CardTitle>
                <span className="tabular text-[11px] text-dim2">{list.length}</span>
              </CardHeader>
              <CardBody className="space-y-2.5">
                {list.map((f) => (
                  <div key={f.id}>
                    <code className="font-mono text-[10.5px] text-dim2">{f.id}</code>
                    <p className="mt-0.5 text-[12.5px] leading-[1.6] text-dim">{f.text}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>

        <div>
          <Card className="border-closed/30">
            <CardHeader className="border-closed/30">
              <CardTitle className="text-closed">Never claim these</CardTitle>
              <span className="tabular text-[11px] text-dim2">{gaps.length}</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[12px] text-dim2">
                The draft validator refuses a submission that mentions any of these, unless the draft names the
                gap on purpose.
              </p>
              {gaps.map((g) => (
                <div key={g.id}>
                  <p className="text-[12.5px] leading-[1.6] text-dim">{g.text}</p>
                  {g.patterns.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.patterns.map((p) => (
                        <span
                          key={p}
                          className="rounded-[5px] border border-closed/25 bg-closed/5 px-1 py-px font-mono text-[10.5px] text-closed/80"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>The rule</CardTitle>
            </CardHeader>
            <CardBody>
              <Eyebrow className="text-dim2">Non-negotiable</Eyebrow>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-dim">
                Every claim in generated copy traces to a fact above. If a fact is not in the library, it gets
                asked for or left out. Never estimated.
              </p>
              <p className="mt-2.5 text-[12.5px] leading-[1.6] text-dim">
                A generated application is a draft, never a submission. Nothing here fills a form or clicks
                apply.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  )
}
