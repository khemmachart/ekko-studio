import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * Selection state for the read-only workspace file tree shown next to a
 * workflow. Keyed by workflow id so switching the active workflow (or
 * closing/reopening the page) does not leak selections across workflows.
 *
 * Exported API is intentionally small: Phase 2 (passing selected paths into
 * a workflow run as context) only needs `getSelectedPaths(workflowId)`.
 */
export const useWorkflowWorkspaceTreeStore = defineStore('workflowWorkspaceTree', () => {
  const selectionsByWorkflowId = reactive(new Map<string, Set<string>>())

  function selectionSetFor(workflowId: string): Set<string> {
    let set = selectionsByWorkflowId.get(workflowId)
    if (!set) {
      set = new Set<string>()
      selectionsByWorkflowId.set(workflowId, set)
    }
    return set
  }

  function getSelectedPaths(workflowId: string): string[] {
    return Array.from(selectionsByWorkflowId.get(workflowId) || [])
  }

  function isSelected(workflowId: string, path: string): boolean {
    return selectionsByWorkflowId.get(workflowId)?.has(path) ?? false
  }

  /** Replace the selection with a single path (plain click). */
  function selectOnly(workflowId: string, path: string): void {
    selectionsByWorkflowId.set(workflowId, new Set([path]))
  }

  /** Toggle one path in/out of the selection (cmd/ctrl-click). */
  function toggleSelection(workflowId: string, path: string): void {
    const set = selectionSetFor(workflowId)
    if (set.has(path)) set.delete(path)
    else set.add(path)
  }

  function clearSelection(workflowId: string): void {
    selectionsByWorkflowId.delete(workflowId)
  }

  return {
    getSelectedPaths,
    isSelected,
    selectOnly,
    toggleSelection,
    clearSelection,
  }
})
