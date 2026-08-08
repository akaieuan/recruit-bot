import { cn } from '@/lib/ui'

/**
 * The two halves of the same judgement, so they sit side by side and get read
 * together. Amber rather than red on the gaps: these are the things to have an
 * answer for, not a verdict on him.
 */
export function FitGaps({ fit, lack }: { fit: string[]; lack: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fit.length > 0 && (
        <Column
          title="Why you fit"
          hint="What you can back with specifics."
          items={fit}
          frame="border-interview/25"
          label="text-interview"
        />
      )}
      {lack.length > 0 && (
        <Column
          title="Where you lack"
          hint="What they will push on. Have the plain answer ready."
          items={lack}
          frame="border-viewed/30"
          label="text-viewed"
        />
      )}
    </div>
  )
}

function Column({
  title,
  hint,
  items,
  frame,
  label,
}: {
  title: string
  hint: string
  items: string[]
  frame: string
  label: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-[8px] border bg-panel', frame)}>
      <div className={cn('flex items-baseline justify-between gap-3 border-b px-3.5 py-2.5', frame)}>
        <p className={cn('eyebrow', label)}>{title}</p>
        <span className="tabular text-[11px] text-dim2">{items.length}</span>
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[11.5px] leading-[1.5] text-dim2">{hint}</p>
        <ol className="mt-3 space-y-2.5">
          {items.map((item, i) => {
            const [claim, support] = splitClaim(item)
            return (
              <li key={item} className="flex gap-2.5">
                <span className="tabular mt-[3px] w-3 shrink-0 font-mono text-[10.5px] text-dim2">{i + 1}</span>
                <p className="text-[12.5px] leading-[1.55]">
                  <span className="text-fg">{claim}</span>
                  {support && <span className="text-dim"> {support}</span>}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/**
 * Emphasis marks where the claim stops and the evidence starts, which is the
 * unit he needs at a glance. Only a short opening sentence counts: past that
 * the whole line would be emphasised and nothing would stand out.
 */
function splitClaim(text: string): [string, string | null] {
  const match = /^(.{0,110}?[.?!])\s+(.+)$/s.exec(text)
  if (!match || !match[1] || !match[2]) return [text, null]
  return [match[1], match[2]]
}
