import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const managerMock = vi.hoisted(() => ({ get: vi.fn() }))
const listUserProfilesMock = vi.hoisted(() => vi.fn())

vi.mock('../../packages/server/src/modules/studio/services/workflow/manager', async importOriginal => {
  const actual = await importOriginal<typeof import('../../packages/server/src/modules/studio/services/workflow/manager')>()
  return {
    ...actual,
    getWorkflowManager: () => managerMock,
  }
})

vi.mock('../../packages/server/src/modules/studio/public/users', () => ({
  listUserProfiles: listUserProfilesMock,
}))

import { listWorkspaceFiles } from '../../packages/server/src/modules/studio/controllers/workflow-workspace'

function ctx(overrides: Record<string, any> = {}) {
  return {
    params: { id: 'workflow-1' },
    query: {},
    state: { user: { id: 'user-1', role: 'super_admin' } },
    status: 200,
    body: undefined as unknown,
    ...overrides,
  } as any
}

describe('workflow workspace file routes', () => {
  let root: string
  let workspace: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hermes-workflow-files-'))
    workspace = join(root, 'workflow-workspace')
    await mkdir(workspace)
    managerMock.get.mockReset()
    listUserProfilesMock.mockReset()
    listUserProfilesMock.mockReturnValue([])
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns 404 when the workflow does not exist', async () => {
    managerMock.get.mockReturnValue(null)
    const request = ctx()
    await listWorkspaceFiles(request)
    expect(request.status).toBe(404)
  })

  it('denies access when the workflow profile is not available to the user', async () => {
    managerMock.get.mockReturnValue({ id: 'workflow-1', profile: 'other', workspace })
    listUserProfilesMock.mockReturnValue([{ profile_name: 'default' }])
    const request = ctx({ state: { user: { id: 'user-1', role: 'member' } } })
    await listWorkspaceFiles(request)
    expect(request.status).toBe(403)
  })

  it('lists the workflow workspace root', async () => {
    await writeFile(join(workspace, 'notes.txt'), 'hello')
    await mkdir(join(workspace, 'sub'))
    managerMock.get.mockReturnValue({ id: 'workflow-1', profile: 'default', workspace })
    const request = ctx()
    await listWorkspaceFiles(request)
    expect(request.status).toBe(200)
    expect(request.body).toMatchObject({
      path: '',
      entries: [
        expect.objectContaining({ name: 'sub', isDir: true }),
        expect.objectContaining({ name: 'notes.txt', isDir: false, size: 5 }),
      ],
    })
  })

  it('lists a nested subfolder', async () => {
    await mkdir(join(workspace, 'sub'))
    await writeFile(join(workspace, 'sub', 'inner.txt'), 'x')
    managerMock.get.mockReturnValue({ id: 'workflow-1', profile: 'default', workspace })
    const request = ctx({ query: { path: 'sub' } })
    await listWorkspaceFiles(request)
    expect(request.status).toBe(200)
    expect(request.body).toMatchObject({
      path: 'sub',
      entries: [expect.objectContaining({ name: 'inner.txt', path: 'sub/inner.txt' })],
    })
  })

  it('rejects a path that escapes the workflow workspace', async () => {
    await mkdir(join(root, 'outside'))
    await writeFile(join(root, 'outside', 'secret.txt'), 'nope')
    managerMock.get.mockReturnValue({ id: 'workflow-1', profile: 'default', workspace })
    const request = ctx({ query: { path: '../outside' } })
    await listWorkspaceFiles(request)
    expect(request.status).toBe(400)
    expect(request.body).toMatchObject({ code: 'invalid_path' })
  })

  it('rejects an absolute path outside the workflow workspace', async () => {
    await mkdir(join(root, 'outside'))
    managerMock.get.mockReturnValue({ id: 'workflow-1', profile: 'default', workspace })
    const request = ctx({ query: { path: join(root, 'outside') } })
    await listWorkspaceFiles(request)
    expect(request.status).toBe(400)
    expect(request.body).toMatchObject({ code: 'invalid_path' })
  })
})
