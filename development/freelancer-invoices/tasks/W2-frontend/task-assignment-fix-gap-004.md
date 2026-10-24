# task-assignment-fix-gap-004 (worker-2, revision from QA)
(QA called this "GAP-003"; renumbered GAP-004 because GAP-003 = PrimeVue licence, now resolved.)

## Task Type
IMPLEMENTATION (bug fix). Same author, exact repro from QA.

## GAP-004 (severity medium-high): editing a record drops its project (R5)
Repro (production build, `/`): click Edit on Monday's first record (3.5 h, Acme Corp, E-Commerce Storefront). The drawer prefills date/client/hours/description, but Project is empty with "Pick a project for this entry."; the estimated total is $0.00, and Save is blocked until the user re-picks the project.
Root cause per QA, in `frontend/app/components/timesheet/RecordDrawer.vue`: the open-watcher does `Object.assign(form, {clientId, projectId, ...})`, then `await refreshProjects()`. The `form.clientId` watcher flushes first, while `availableProjects` is still empty, so `selectedProject` is undefined and it sets `form.projectId = null`. It doesn't re-run after the projects load.

## Fix requirements
- Make the clientId watcher only clear `projectId` when the user changes the client: compare old vs new clientId and skip while hydrating, OR set a `hydrating` flag around the assign + refresh, OR re-apply `record.projectId` after the refresh resolves. Pick the most robust option; the selected project must survive regardless of load timing.
- Changing the client by hand must still clear an incompatible project (existing behaviour).
- Regression test: mount RecordDrawer with an existing record and projects that resolve asynchronously; assert projectId is kept and the estimated total is non-zero; then change the client and assert projectId clears.

## Verification
`npm run typecheck && npm test && npm run build` green; paste evidence. Don't start long-lived servers. Conserve tokens.

## Reporting
Append `## GAP-004 fix` to progress-report.md, then `SendMessage(to: "team-lead", message: "COMPLETE: GAP-004 fixed. <one line>. typecheck/test/build: <numbers>", summary: "GAP-004 fixed")` (fallback `main`).
