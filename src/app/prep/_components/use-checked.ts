'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Ticks live in localStorage. The sheet is a read surface and a checkbox is
 * not worth a round trip to the database.
 *
 * Entries are keyed by the item text rather than its index: a rewritten sheet
 * reorders items, and an index would silently tick the wrong line.
 */
export function useChecked(storageKey: string) {
  const [checked, setChecked] = useState<readonly string[]>([])

  // A server render cannot know what this browser ticked, so read after mount.
  // The hook is mounted per sheet, so the key never changes underneath it.
  useEffect(() => {
    setChecked(read(storageKey))
  }, [storageKey])

  const commit = useCallback(
    (next: string[]) => {
      setChecked(next)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Storage can be unavailable. The sheet still works, just forgetfully.
      }
    },
    [storageKey],
  )

  const toggle = useCallback(
    (item: string) => {
      commit(checked.includes(item) ? checked.filter((v) => v !== item) : [...checked, item])
    },
    [checked, commit],
  )

  const reset = useCallback(() => commit([]), [commit])

  return { checked, toggle, reset }
}

function read(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}
