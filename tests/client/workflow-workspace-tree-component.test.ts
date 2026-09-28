// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WorkflowWorkspaceTree from '@/components/hermes/workflow/WorkflowWorkspaceTree.vue'
import { useWorkflowWorkspaceTreeStore } from '@/stores/hermes/workflow-workspace-tree'

const mockWorkflowsApi = vi.hoisted(() => ({
  listWorkflowWorkspaceFiles: vi.fn(),
}))

vi.mock('@/api/studio/workflows', () => mockWorkflowsApi)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('naive-ui', () => ({
  NButton: { template: '<button class="refresh-stub" @click="$emit(\'click\')"><slot /></button>' },
  NTooltip: { template: '<div><slot name="trigger" /><slot /></div>' },
  NTree: {
    props: ['data', 'nodeProps', 'renderLabel'],
    template: `
      <div class="n-tree-stub">
        <button
          v-for="item in data"
          :key="item.key"
          class="tree-node-stub"
          @click="nodeProps({ option: item }).onClick($event)"
        >{{ item.label }}</button>
      </div>
    `,
  },
}))

function entry(name: string, isDir = false) {
  return { name, path: name, isDir, size: 0, modTime: '2026-09-28T00:00:00.000Z' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

describe('WorkflowWorkspaceTree', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockWorkflowsApi.listWorkflowWorkspaceFiles.mockReset()
  })

  it('ignores a slower response for the previously selected workflow', async () => {
    const slow = deferred<any>()
    mockWorkflowsApi.listWorkflowWorkspaceFiles.mockImplementation((id: string) => (
      id === 'wf-a' ? slow.promise : Promise.resolve({ entries: [entry('b.txt')], path: '', absolutePath: '/b' })
    ))
    const wrapper = mount(WorkflowWorkspaceTree, { props: { workflowId: 'wf-a', workspace: '/a' } })
    await wrapper.setProps({ workflowId: 'wf-b', workspace: '/b' })
    await flushPromises()
    slow.resolve({ entries: [entry('a.txt')], path: '', absolutePath: '/a' })
    await flushPromises()
    const labels = wrapper.findAll('.tree-node-stub').map(node => node.text())
    expect(labels).toEqual(['b.txt'])
  })

  it('lists files even when the workflow has no saved workspace (server default)', async () => {
    mockWorkflowsApi.listWorkflowWorkspaceFiles.mockResolvedValue({ entries: [entry('default.txt')], path: '', absolutePath: '/default' })
    const wrapper = mount(WorkflowWorkspaceTree, { props: { workflowId: 'wf-a', workspace: null } })
    await flushPromises()
    expect(wrapper.findAll('.tree-node-stub').map(node => node.text())).toEqual(['default.txt'])
  })

  it('keeps each workflow selection when switching and clears it when the saved workspace changes', async () => {
    mockWorkflowsApi.listWorkflowWorkspaceFiles.mockResolvedValue({ entries: [entry('a.txt')], path: '', absolutePath: '/a' })
    const store = useWorkflowWorkspaceTreeStore()
    const wrapper = mount(WorkflowWorkspaceTree, { props: { workflowId: 'wf-a', workspace: '/a' } })
    await flushPromises()
    await wrapper.find('.tree-node-stub').trigger('click')
    expect(store.getSelectedPaths('wf-a')).toEqual(['a.txt'])

    await wrapper.setProps({ workflowId: 'wf-b', workspace: '/b' })
    await wrapper.setProps({ workflowId: 'wf-a', workspace: '/a' })
    await flushPromises()
    expect(store.getSelectedPaths('wf-a')).toEqual(['a.txt'])

    await wrapper.setProps({ workflowId: 'wf-a', workspace: '/a-new' })
    await flushPromises()
    expect(store.getSelectedPaths('wf-a')).toEqual([])
  })
})
