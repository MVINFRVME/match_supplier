import { useCallback, useState } from 'react'
import { loadPriorities, savePriorities } from './storage'
import type { Priorities } from './types'

/** Приоритеты закупщика живут в localStorage и общие для всех экранов. */
export function usePriorities() {
  const [priorities, setPriorities] = useState<Priorities>(loadPriorities)

  const update = useCallback((next: Priorities) => {
    savePriorities(next)
    setPriorities(next)
  }, [])

  return [priorities, update] as const
}
