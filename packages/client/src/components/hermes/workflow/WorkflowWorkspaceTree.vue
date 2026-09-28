<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { NButton, NTooltip, NTree } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { listWorkflowWorkspaceFiles } from '@/api/studio/workflows'
import type { FileEntry } from '@/api/studio/workspace-files'
import { useWorkflowWorkspaceTreeStore } from '@/stores/hermes/workflow-workspace-tree'

const { t } = useI18n()
const store = useWorkflowWorkspaceTreeStore()

const props = defineProps<{
  workflowId: string | null
  workspace: string | null
}>()

interface WorkspaceTreeOption extends TreeOption {
  entry: FileEntry
}

const treeData = ref<WorkspaceTreeOption[]>([])
// Absolute root reported by the server; it falls back to the default
// workflow workspace when none is saved, so the prop alone is not enough.
const rootPath = ref('')
const loading = ref(false)
const loadError = ref(false)
const failedKeys = ref(new Set<string>())
const treeInstanceKey = ref(0)
let loadSeq = 0

const hasWorkflow = computed(() => Boolean(props.workflowId))
const isEmptyFolder = computed(() => !loading.value && !loadError.value && treeData.value.length === 0)

function toOption(entry: FileEntry): WorkspaceTreeOption {
  return {
    key: entry.path,
    label: entry.name,
    isLeaf: !entry.isDir,
    entry,
  }
}

async function fetchEntries(path: string) {
  if (!props.workflowId) return { entries: [] as WorkspaceTreeOption[], absolutePath: '' }
  const result = await listWorkflowWorkspaceFiles(props.workflowId, path)
  return { entries: result.entries.map(toOption), absolutePath: result.absolutePath || '' }
}

async function loadRoot(): Promise<void> {
  const seq = ++loadSeq
  failedKeys.value = new Set()
  rootPath.value = ''
  if (!props.workflowId) {
    treeData.value = []
    loadError.value = false
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const root = await fetchEntries('')
    if (seq !== loadSeq) return
    treeData.value = root.entries
    rootPath.value = root.absolutePath
  } catch {
    if (seq !== loadSeq) return
    treeData.value = []
    loadError.value = true
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function handleLoad(node: TreeOption): Promise<void> {
  const seq = loadSeq
  const key = node.key as string
  try {
    const { entries } = await fetchEntries(key)
    if (seq !== loadSeq) return
    node.children = entries
    if (failedKeys.value.has(key)) {
      const next = new Set(failedKeys.value)
      next.delete(key)
      failedKeys.value = next
    }
  } catch {
    if (seq !== loadSeq) return
    // Leave the folder expandable-but-empty and flag it instead of
    // pretending it has no entries (unreadable dir, symlink out of workspace).
    node.children = []
    failedKeys.value = new Set(failedKeys.value).add(key)
  }
}

function handleRefresh() {
  treeInstanceKey.value += 1
  void loadRoot()
}

function isSelected(path: string): boolean {
  return props.workflowId ? store.isSelected(props.workflowId, path) : false
}

function handleEntryClick(entry: FileEntry, event: MouseEvent) {
  if (!props.workflowId) return
  if (event.metaKey || event.ctrlKey) {
    store.toggleSelection(props.workflowId, entry.path)
  } else {
    store.selectOnly(props.workflowId, entry.path)
  }
}

function renderPrefix({ option }: { option: TreeOption }) {
  const entry = (option as WorkspaceTreeOption).entry
  return entry.isDir
    ? h('svg', { class: 'workspace-tree-icon', viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
        h('path', { d: 'M1.5 3.5h5l1.5 2h6.5v7.5h-13z' }),
      ])
    : h('svg', { class: 'workspace-tree-icon', viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
        h('path', { d: 'M3 1.5h6l4 4v9H3z' }),
        h('path', { d: 'M9 1.5v4h4' }),
      ])
}

function renderLabel({ option }: { option: TreeOption }) {
  const label = String(option.label || '')
  if (failedKeys.value.has(option.key as string)) {
    const error = t('workflow.workspaceTree.loadError')
    return h('span', { class: 'workspace-tree-label workspace-tree-label--error', title: `${label} — ${error}` }, [
      label,
      h('span', { class: 'workspace-tree-label-error' }, ` · ${error}`),
    ])
  }
  return h('span', { class: 'workspace-tree-label', title: label }, label)
}

function nodeProps({ option }: { option: TreeOption }) {
  const entry = (option as WorkspaceTreeOption).entry
  return {
    class: ['workspace-tree-node', { 'workspace-tree-node--selected': isSelected(entry.path) }],
    onClick: (event: MouseEvent) => handleEntryClick(entry, event),
  }
}

watch(
  () => [props.workflowId, props.workspace] as const,
  ([nextId, nextWorkspace], previous) => {
    // Selection is kept per workflow id, so switching workflows keeps each
    // workflow's selection. Only a saved workspace change for the same
    // workflow clears it: the old paths no longer resolve against the new root.
    if (previous) {
      const [previousId, previousWorkspace] = previous
      if (previousId === nextId && previousWorkspace !== nextWorkspace && nextId) {
        store.clearSelection(nextId)
      }
    }
    treeInstanceKey.value += 1
    void loadRoot()
  },
  { immediate: true },
)
</script>

<template>
  <aside class="workflow-workspace-tree">
    <div class="workspace-tree-header">
      <span class="workspace-tree-title" :title="rootPath">{{ t('workflow.workspaceTree.title') }}</span>
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton
            quaternary
            size="tiny"
            circle
            :disabled="!hasWorkflow"
            :aria-label="t('workflow.workspaceTree.refresh')"
            @click="handleRefresh"
          >
            <template #icon>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </template>
          </NButton>
        </template>
        {{ t('workflow.workspaceTree.refresh') }}
      </NTooltip>
    </div>

    <div v-if="!hasWorkflow" class="workspace-tree-empty">
      {{ t('workflow.workspaceTree.emptyNoWorkflow') }}
    </div>
    <div v-else-if="loading" class="workspace-tree-empty">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="loadError" class="workspace-tree-empty">
      {{ t('workflow.workspaceTree.loadError') }}
    </div>
    <div v-else-if="isEmptyFolder" class="workspace-tree-empty">
      {{ t('workflow.workspaceTree.emptyFolder') }}
    </div>
    <NTree
      v-else
      :key="treeInstanceKey"
      class="workspace-tree-nodes"
      :data="treeData"
      :on-load="handleLoad"
      :render-label="renderLabel"
      :render-prefix="renderPrefix"
      :node-props="nodeProps"
      :selectable="false"
      :indent="6"
      block-line
    />
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.workflow-workspace-tree {
  width: $sidebar-width;
  min-height: 0;
  align-self: stretch;
  margin: 10px 10px 10px 0;
  background: $bg-sidebar-surface;
  border: 1px solid $border-color;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.workspace-tree-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid $border-color;
}

.workspace-tree-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.workspace-tree-empty {
  padding: 16px 10px;
  font-size: 12px;
  color: $text-muted;
  text-align: center;
}

.workspace-tree-nodes {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

:deep(.workspace-tree-node) {
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), 0.06);
  }
}

:deep(.workspace-tree-node--selected) {
  background-color: rgba(var(--accent-primary-rgb), 0.12);
}

:deep(.workspace-tree-label) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  font-size: 13px;
}

:deep(.workspace-tree-label-error) {
  color: $text-muted;
  font-size: 11px;
}

:deep(.workspace-tree-icon) {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: $text-muted;
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
