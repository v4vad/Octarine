import { useState, useCallback } from 'react'
import { AppState } from './types'

const MAX_HISTORY_SIZE = 50

export interface UseHistoryReturn {
  // Current state
  state: AppState
  // Actions
  setState: (newState: AppState) => void
  undo: () => void
  redo: () => void
  // Status
  canUndo: boolean
  canRedo: boolean
}

export function useHistory(initialState: AppState): UseHistoryReturn {
  const [past, setPast] = useState<AppState[]>([])
  const [present, setPresent] = useState<AppState>(initialState)
  const [future, setFuture] = useState<AppState[]>([])

  const setState = useCallback((newState: AppState) => {
    setPast(prev => {
      const newPast = [...prev, present]
      // Limit history size
      if (newPast.length > MAX_HISTORY_SIZE) {
        return newPast.slice(-MAX_HISTORY_SIZE)
      }
      return newPast
    })
    setPresent(newState)
    setFuture([]) // Clear redo stack on new action
  }, [present])

  const undo = useCallback(() => {
    if (past.length === 0) return

    const previous = past[past.length - 1]
    const newPast = past.slice(0, -1)

    setPast(newPast)
    setPresent(previous)
    setFuture(prev => [present, ...prev])
  }, [past, present])

  const redo = useCallback(() => {
    if (future.length === 0) return

    const next = future[0]
    const newFuture = future.slice(1)

    setPast(prev => [...prev, present])
    setPresent(next)
    setFuture(newFuture)
  }, [future, present])

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
