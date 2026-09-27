import { resolve as pathResolve } from 'path'
import { readdir, stat } from 'fs/promises'
import type { Context } from 'koa'
import { getWorkflowManager } from '../services/workflow/manager'
import { listUserProfiles } from '../public/users'
import {
  decorateWorkspaceEntries,
  defaultWorkflowWorkspace,
  resolveWorkspacePath,
  workspaceRelativePath,
} from '../public/workspace-files'

function profileName(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'default'
}

function canAccessProfile(ctx: Context, profile: string | null | undefined): boolean {
  const user = ctx.state?.user
  if (!user || user.role === 'super_admin') return true
  const allowed = new Set(listUserProfiles(user.id).map(entry => entry.profile_name))
  return allowed.has(profileName(profile))
}

function requiredId(ctx: Context): string | null {
  const id = typeof ctx.params?.id === 'string' ? ctx.params.id.trim() : ''
  if (id) return id
  ctx.status = 400
  ctx.body = { error: 'id is required' }
  return null
}

function handleWorkspaceError(ctx: Context, err: any): void {
  const status = Number(err?.status || 0)
  ctx.status = status >= 400 ? status : err?.code === 'ENOENT' ? 404 : 500
  ctx.body = { error: err?.message || 'Failed to access workflow workspace', code: err?.code || 'workspace_file_error' }
}

export async function listWorkspaceFiles(ctx: Context): Promise<void> {
  try {
    const id = requiredId(ctx)
    if (!id) return

    const workflow = getWorkflowManager().get(id)
    if (!workflow) {
      ctx.status = 404
      ctx.body = { error: 'workflow not found' }
      return
    }
    if (!canAccessProfile(ctx, workflow.profile)) {
      ctx.status = 403
      ctx.body = { error: `Profile "${profileName(workflow.profile)}" is not available for this user` }
      return
    }

    const workspace = workflow.workspace || defaultWorkflowWorkspace(profileName(workflow.profile), workflow.id)
    const { relativePath, fullPath } = await resolveWorkspacePath(workspace, ctx.query.path, {
      access: 'contained',
      allowEmpty: true,
      missingWorkspaceMessage: 'Workflow workspace not found',
    })

    const info = await stat(fullPath)
    if (!info.isDirectory()) {
      ctx.status = 400
      ctx.body = { error: 'Not a directory', code: 'not_a_directory' }
      return
    }

    const dirEntries = await readdir(fullPath, { withFileTypes: true })
    const entries = await Promise.all(dirEntries.map(async entry => {
      const entryFullPath = pathResolve(fullPath, entry.name)
      const entryStat = await stat(entryFullPath)
      return {
        name: entry.name,
        path: workspaceRelativePath(workspace, entryFullPath),
        absolutePath: entryFullPath,
        isDir: entryStat.isDirectory(),
        size: entryStat.size,
        modTime: entryStat.mtime.toISOString(),
      }
    }))
    entries.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))

    const decorated = await decorateWorkspaceEntries(workspace, relativePath, entries)
    ctx.body = {
      entries: decorated.entries,
      path: relativePath,
      absolutePath: fullPath,
      ...decorated.directoryDecoration,
    }
  } catch (err: any) {
    handleWorkspaceError(ctx, err)
  }
}
