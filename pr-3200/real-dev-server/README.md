Real dev-server (temp state) screenshots used as test evidence for #3200. Some predate later fixes (e.g. r02/r10 show the old `[+][...]` header order); see the mocked-e2e set for the final UI.

There is no r06 (not captured).

- `r01-new-category-form.png` — admin "New Category" dialog with the full preset form (Agent / Profiles / Provider / Models / Workspace, all Default) and the "API keys are never saved" hint
- `r02-sidebar-new-category-expanded.png` — toast "Category \"Release Notes\" created"; new category appears in the sidebar with its own "+ New Chat" row
- `r03-duplicate-name-error.png` — New Category dialog rejecting "ai passport": "A category with this name already exists"
- `r04-drawer-prefilled.png` — category New Chat drawer prefilled from the "AI Passport" preset (Hermes / OpenCode Free / mimo-v2.5-free / workspace), with the "changes apply to this chat only" banner
- `r05-plan-first-message.png` — chat created from the preset; first message `/plan ...` sent as-is (bridge replies "not a supported bridge command: /plan")
- `r07-set-preset-stale-warnings.png` — "Preset for \"Stale Folder\"" dialog warning that the saved workspace folder no longer exists and the default workspace is used
- `r08-delete-confirm-preset.png` — Delete category confirm: "Its New Chat preset will be removed and its sessions will move to Uncategorized"
- `r09-top-new-chat-unchanged.png` — top-level New Chat drawer is unchanged (no preset banner, Category = Uncategorized)
- `r10-sidebar-admin.png` — admin sidebar with Recent / AI Passport / category sections (old header action order)
- `r11-drawer-A-claude-preset.png` — drawer from the "Claude Preset" category: Agent Claude, Launch mode Global config
- `r12-drawer-B-no-preset-default-agent.png` — drawer from "Member Cat" (no agent in preset): falls back to the default agent Hermes / OpenCode Free
- `r13-drawer-stale-workspace.png` — drawer from "Stale Folder": inline warning that the preset workspace no longer exists, default workspace used
- `r14-set-preset-no-reasoning-effort.png` — "Preset for \"AI Passport\"" dialog with Hermes + OpenCode Free + mimo-v2.5-free; no reasoning-effort field shown
- `r15-member-category-menu.png` — member user's category menu shows only Rename / Delete category (no preset option)
- `r16-member-new-category-name-only.png` — member user's New Category dialog is name-only (no preset fields)
- `r17-drawer-relative-workspace.png` — "Rel Exists" preset with relative workspace `packages/client` resolved and selected
- `r18-drawer-relative-workspace-missing.png` — "Rel Missing" preset: warning that workspace `no-such-dir/app` no longer exists, default used
- `r19-drawer-stale-provider-base-url.png` — "Stale Gateway" preset: warnings for removed provider, model, unused API mode and unused base URL, each falling back to defaults
- `r20-drawer-provider-own-base-url.png` — "Own URL" preset on OpenCode Free: base URL `https://proxy.example.test/v1` ignored in favor of the provider's own settings
