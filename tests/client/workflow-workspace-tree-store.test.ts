import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkflowWorkspaceTreeStore } from '@/stores/hermes/workflow-workspace-tree'

describe('useWorkflowWorkspaceTreeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('selects a single path, replacing any prior selection', () => {
    const store = useWorkflowWorkspaceTreeStore()
    store.selectOnly('workflow-1', 'a.txt')
    expect(store.getSelectedPaths('workflow-1')).toEqual(['a.txt'])
    store.selectOnly('workflow-1', 'b.txt')
    expect(store.getSelectedPaths('workflow-1')).toEqual(['b.txt'])
    expect(store.isSelected('workflow-1', 'a.txt')).toBe(false)
    expect(store.isSelected('workflow-1', 'b.txt')).toBe(true)
  })

  it('toggles paths in and out of a multi-select set', () => {
    const store = useWorkflowWorkspaceTreeStore()
    store.selectOnly('workflow-1', 'a.txt')
    store.toggleSelection('workflow-1', 'b.txt')
    expect(store.getSelectedPaths('workflow-1').sort()).toEqual(['a.txt', 'b.txt'])
    store.toggleSelection('workflow-1', 'a.txt')
    expect(store.getSelectedPaths('workflow-1')).toEqual(['b.txt'])
  })

  it('keeps selection state isolated per workflow id', () => {
    const store = useWorkflowWorkspaceTreeStore()
    store.selectOnly('workflow-1', 'a.txt')
    store.selectOnly('workflow-2', 'z.txt')
    expect(store.getSelectedPaths('workflow-1')).toEqual(['a.txt'])
    expect(store.getSelectedPaths('workflow-2')).toEqual(['z.txt'])
  })

  it('clears selection for one workflow without touching others', () => {
    const store = useWorkflowWorkspaceTreeStore()
    store.selectOnly('workflow-1', 'a.txt')
    store.selectOnly('workflow-2', 'z.txt')
    store.clearSelection('workflow-1')
    expect(store.getSelectedPaths('workflow-1')).toEqual([])
    expect(store.getSelectedPaths('workflow-2')).toEqual(['z.txt'])
  })

  it('returns an empty selection for an unknown workflow id', () => {
    const store = useWorkflowWorkspaceTreeStore()
    expect(store.getSelectedPaths('unknown')).toEqual([])
    expect(store.isSelected('unknown', 'a.txt')).toBe(false)
  })
})
