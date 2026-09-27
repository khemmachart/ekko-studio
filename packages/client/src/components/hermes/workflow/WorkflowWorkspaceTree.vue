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
const rootLabel = computed(() => {
  const workspace = String(props.workspace || '').replace(/[\\/]+$/, '')
  return workspace ? workspace.split(/[\\/]/).pop() || workspace : ''
})
const loading = ref(false)
const loadError = ref(false)
const treeInstanceKey = ref(0)
let loadSeq = 0

const hasWorkflow = computed(() => Boolean(props.workflowId))
const hasWorkspace = computed(() => Boolean(props.workspace))
const isEmptyFolder = computed(() => !loading.value && !loadError.value && hasWorkspace.value && treeData.value.length === 0)

function toOption(entry: FileEntry): WorkspaceTreeOption {
  return {
    key: entry.path,
    label: entry.name,
    isLeaf: !entry.isDir,
    entry,
  }
}

async function loadChildren(path: string): Promise<WorkspaceTreeOption[]> {
  if (!props.workflowId) return []
  const result = await listWorkflowWorkspaceFiles(props.workflowId, path)
  return result.entries
    .map(toOption)
    .sort((a, b) => (
      a.entry.isDir === b.entry.isDir ? a.entry.name.localeCompare(b.entry.name) : a.entry.isDir ? -1 : 1
    ))
}

async function loadRoot(): Promise<void> {
  const seq = ++loadSeq
  if (!props.workflowId || !props.workspace) {
    treeData.value = []
    loadError.value = false
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const children = await loadChildren('')
    if (seq !== loadSeq) return
    treeData.value = children
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
  try {
    const children = await loadChildren(node.key as string)
    if (seq === loadSeq) node.children = children
  } catch {
    if (seq === loadSeq) node.children = []
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
    if (previous) {
      const [previousId, previousWorkspace] = previous
      if (previousId !== nextId) {
        // Switched to a different workflow: drop the old workflow's
        // selection, but keep any prior selection for the workflow we are
        // returning to (state is keyed per workflow id in the store).
        if (previousId) store.clearSelection(previousId)
      } else if (previousWorkspace !== nextWorkspace && nextId) {
        // Same workflow, workspace folder changed (e.g. via FolderPicker):
        // previously selected paths no longer resolve against the new root.
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
      <span class="workspace-tree-title" :title="rootLabel">{{ t('workflow.workspaceTree.title') }}</span>
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton
            quaternary
            size="tiny"
            circle
            :disabled="!hasWorkflow || !hasWorkspace"
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
    <div v-else-if="!hasWorkspace" class="workspace-tree-empty">
      {{ t('workflow.workspaceTree.emptyNoWorkspace') }}
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
  margin: 10px 0;
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

:deep(.workspace-tree-icon) {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: $text-muted;
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: $breakpoint-mobile) {
  .workflow-workspace-tree {
    display: none;
  }
}
</style>
