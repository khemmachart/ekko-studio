import { resolve as pathResolve } from 'path'
import { readdir, stat } from 'fs/promises'
import type { Context } from 'koa'
import { getWorkflowManager } from '../services/workflow/manager'
import { canAccessProfile, profileName, requiredId } from './workflows'
import {
  decorateWorkspaceEntries,
  defaultWorkflowWorkspace,
  resolveWorkspacePath,
  workspaceRelativePath,
} from '../public/workspace-files'

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
    const statted = await Promise.all(dirEntries.map(async entry => {
      const entryFullPath = pathResolve(fullPath, entry.name)
      try {
        const entryStat = await stat(entryFullPath)
        return {
          name: entry.name,
          path: workspaceRelativePath(workspace, entryFullPath),
          absolutePath: entryFullPath,
          isDir: entryStat.isDirectory(),
          size: entryStat.size,
          modTime: entryStat.mtime.toISOString(),
        }
      } catch {
        // Skip entries that cannot be stat'ed (dangling symlink, EACCES)
        // instead of failing the whole listing.
        return null
      }
    }))
    const entries = statted.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
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
