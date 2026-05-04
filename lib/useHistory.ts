import { useReducer, useCallback } from 'react'
import { AppState } from './types'

const MAX_HISTORY_SIZE = 50

export interface UseHistoryReturn {
  // Current state
  state: AppState
  // Actions
  setState: (newState: AppState | ((prev: AppState) => AppState)) => void
  replaceState: (newState: AppState) => void  // Set state without creating undo history
  undo: () => void
  redo: () => void
  // Status
  canUndo: boolean
  canRedo: boolean
}

type HistoryState = {
  past: AppState[]
  present: AppState
  future: AppState[]
}

type HistoryAction =
  | { type: 'SET'; newState: AppState | ((prev: AppState) => AppState) }
  | { type: 'REPLACE'; newState: AppState }
  | { type: 'UNDO' }
  | { type: 'REDO' }

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'SET': {
      const nextPresent = typeof action.newState === 'function'
        ? action.newState(state.present)
        : action.newState
      const newPast = [...state.past, state.present]
      return {
        past: newPast.length > MAX_HISTORY_SIZE ? newPast.slice(-MAX_HISTORY_SIZE) : newPast,
        present: nextPresent,
        future: [],
      }
    }
    case 'REPLACE':
      return { past: [], present: action.newState, future: [] }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      }
    }
  }
}

export function useHistory(initialState: AppState): UseHistoryReturn {
  const [{ past, present, future }, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
  })

  // dispatch is permanently stable — no deps needed on any of these
  const setState = useCallback((newState: AppState | ((prev: AppState) => AppState)) => {
    dispatch({ type: 'SET', newState })
  }, [])

  const replaceState = useCallback((newState: AppState) => {
    dispatch({ type: 'REPLACE', newState })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  return {
    state: present,
    setState,
    replaceState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
