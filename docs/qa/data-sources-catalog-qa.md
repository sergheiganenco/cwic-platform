# QA Plan — Data Sources and Data Catalog

Scope: Manual QA coverage for the Data Sources tab and the Data Catalog. Includes feature verification, error/edge cases, API contract checks, and UI/UX behaviors visible in the current codebase.

Environment
- Frontend: `frontend` (Vite). Start with `npm run dev:frontend` or root `npm run dev`.
- API Gateway: `backend/api-gateway` on `http://localhost:8000` (proxy to data-service under `/api`).
- Data Service: `backend/data-service` (Postgres metadata store). Exposes catalog + data-source endpoints.
- Recommended: Seed a few sources (PostgreSQL, MSSQL) with both server- and database-scope.

Test Data Matrix
- At least one of each: 
  - PostgreSQL (server-level), PostgreSQL (database-level)
  - SQL Server (server-level)
  - One invalid/locked account to surface error paths
  - Sources with/without tags; with/without usage metadata

==================================================

Data Sources — Page-Level
1) Load and Summary
   - Open Data Sources page; verify header, counts, and summary cards render without errors.
   - Cards: Total Sources, Coverage (servers/databases), Connection Status (active/errors), Overall Health.
2) Refresh/Test All
   - Click “Test Connections”; expect: spinner, test fired per source, statuses update, counts/health recalc.
3) Search and Quick Filters
   - Search by name/host/database/type text; expect filtered list and count.
   - Status filter: active/inactive/pending/error/testing.
   - Type filter: verify options include DBs and storages (e.g., postgresql, mysql, mssql, mongodb...).
   - Scope filter: “Server-Level” vs “Database-Level”.
   - Advanced toggles: Has Errors, Has Usage; verify non-empty filtering.
   - Tag chips: selection toggles and ARIA pressed states; multiple tags OR behavior.
4) View and Pagination
   - Switch grid/list views; confirm persistence while paging.
   - Change page size; verify paging window and counts.
5) Bulk Actions
   - Select multiple cards; Test All, Sync All; ensure toast/alerts summarize success/fail; Clear selection.

Data Sources — Card-Level
1) Visuals and Metadata
   - Status chip reflects active/error/testing/pending/inactive.
   - Last Sync/Test times are humanized; host and optional port shown; bucket/baseUrl where applicable.
   - Health indicator percentage matches status heuristics.
2) Actions
   - Test: shows loading; on success, UI refreshes; on failure, error toast.
   - Sync: shows loading; success toast with assets count; refresh updates timestamps; handles failure.
   - Menu: Configure, Delete, Browse Databases (if provided); Delete prompts and removes the item.
3) Tags and Usage
   - Tags render with “+N more” expander; Usage block renders queriesCount/lastUsed correctly.

Data Sources — Add/Configure
1) Add Connection Wizard
   - Launch wizard; enter valid PostgreSQL server-level config; Test connection; expect success.
   - Enter invalid credentials; expect clear failure message.
   - Verify database discovery (where supported) shows database list.
   - Create source; verify appears in list with correct type/scope/tags.
2) Configure Modal
   - Open Configure; edit name/description/tags/custom metadata; Save persists and closes.
   - Test within modal uses current form configuration; success/failure banners render.
   - Security/Advanced inputs (SSL, timeouts, pool sizes) update form state.

Data Sources — Browse Databases
1) Per-Source Browse
   - Click “Show Available Databases”; expect discovery call `/api/catalog/databases?dataSourceId=...`.
   - Loading state shown; results group and counts visible (non-system default).
2) Search and System DBs
   - If 5+ databases, search bar appears; filter results by substring.
   - Toggle “Include system databases”; system databases are disabled for sync and marked appropriately.
3) Sync Specific Database
   - Click sync icon on a non-system DB; expect toast showing assets discovered; metadata (isSynced/lastSyncAt) reflects.
4) “Click to create connection”
   - Clicking DB name sets global DB scope; verify subsequent views reflect selected scope if applicable.

API Contract (Data Sources)
- GET `/api/data-sources` with pagination, filters (`status`, `type`), sort.
- POST `/api/data-sources` create; PUT `/:id`; DELETE `/:id`.
- POST `/:id/test` returns normalized ConnectionTestResult.
- POST `/:id/sync` (optional `database`) returns tolerant SyncResult.
- GET `/:id/databases` returns string[] | {name}[] | {databases: ...}.

Error/Edge Cases (Data Sources)
- Network failures: toasts/messages show; list fallback clears items.
- Frequent refresh debouncing honored; no thrashing.
- Inconsistent server status naming (‘connected’/‘disconnected’) maps to UI status.
- Wizard hard-coded URL `http://localhost:8000` reachable in dev; note prod alignment.

Observations (to verify/track)
- Some glyph strings appear corrupted in UI (e.g., connector glyphs). Replace with proper icons.
- Wizard uses direct fetch to `http://localhost:8000/api/data-sources/test` with `x-dev-auth`; consider using shared HTTP client + relative `/api` path.

==================================================

Data Catalog — Page-Level
1) Initial Load and Stats
   - Confirm summary cards (Total Assets, Tables, Views, Total Rows, Data Sources) reflect backend summary under current filters.
2) Search & Filters
   - Search by table/schema/description; ensure server `search` param sent and client filter matches.
   - Data Source dropdown: values from assets + dataSources; select one and ensure results match source.
   - Database picker: supports multiple selections; shows only non-system DBs; Clear All works.
   - Schema filter: populated based on current scope (post-filter assets); selecting filters list.
   - Type filter: All/Table/View updates both server and client filtering.
   - Always exclude system objects by default (objectType=user) — verify no `pg_catalog`, `sys`, etc.
3) View Modes & Pagination
   - Grid/Table/Compact modes; pagination UI; page changes call `updateFilters({ page })`.
4) Clear Filters
   - “Clear all filters” resets search/source/databases/schema/type and page=1; list repopulates.

Data Catalog — Asset Cards and Details
1) Cards
   - Type chip (TABLE/VIEW), name, schema, DS name, row/column counts; trust score ring shows value or N/A.
   - Selection checkbox toggles; batch selection count reflects.
   - Actions: Bookmark toggle, Share (native share or link copied), Rate (interactive stars).
2) Details Panel
   - Overview: metadata values, description; Edit opens editor; Save persists via `/api/catalog/assets/:id/description`.
   - Generate Description: `/description` with `{ generate: true }` updates content.
   - Columns tab: fetches `/api/catalog/assets/:id/columns`; shows empty/loaded/errored states; PK/required badges.
   - Lineage tab: fetches `/api/catalog/assets/:id/lineage`; verify loading/error/loaded.
   - Usage tab (if implemented): charts/stats load without errors.
3) Preview & Query
   - Preview: `/api/catalog/assets/:id/preview?limit=20`; handles both success and error payloads.
   - Query: `/api/catalog/assets/:id/query`; shows SQL text or fallback.

API Contract (Catalog)
- GET `/api/catalog/assets` with filters: `search`, `type`, `dataSourceId|datasourceId`, `databases` (comma list), `schema`, `objectType`, paging/sort.
- GET `/api/catalog/summary` reflecting the same filter set.
- GET `/api/catalog/databases` (optional `dataSourceId`); returns { dataSourceId, dataSourceName, databases: [{ name, isSystem, isSynced, lastSyncAt, assetCount }], systemDatabases }[]
- Asset endpoints: `/api/catalog/assets/:id` (+ `/columns`, `/lineage`, `/preview`, `/query`, `/bookmark`, `/rate`, `/profile`, `/description`).

Error/Edge Cases (Catalog)
- Deep linking via `?asset=<id>` opens details; fetches from API if not in current page.
- Handle no results: Empty state encourages connecting data sources or clearing filters.
- Share fallback to clipboard when `navigator.share` unavailable.
- Rate/Bookmark/Profile actions show clear success/failure notifications and refresh state.

Accessibility & UX
- Buttons and interactive elements have labels/ARIA where present.
- Focus management: closing modals/panels returns focus; menus close on Esc/outside click.
- Loading states visible for network operations; disabled states prevent double-submits.

Non-Blocking Findings for Triage
- Occasional mojibake/garbled characters in UI strings (icons/text). Replace with standard icons/strings.
- Mixed `alert` vs `toast` patterns; consider standardizing on unified notification system.

Pass/Fail Acceptance
- Pass when all features above work with accurate filtering/paging, crisp error handling, and no console errors.
- Fail on broken filters, API contract mismatches, missing states (loading/empty/error), or corrupted UI text.

==================================================

Detailed Test Cases (Step-by-Step)

Legend: DS = Data Sources, DC = Data Catalog

Data Sources — Page and List
- DS-001 Load page
  - Pre: App running, gateway + data-service reachable.
  - Steps: Navigate to Data Sources.
  - Expect: No console errors; summary cards render with counts; “Add Connection”, “Test Connections” visible.
- DS-002 Debounced search
  - Steps: Type partial name in search; pause ~150–300ms.
  - Expect: Filtered list updates; paging resets to 1; clearing search restores full list.
- DS-003 Status filter
  - Steps: Choose each Status option; verify results match and counts update.
  - Expect: Only records with mapped status appear (server ‘connected’ → UI ‘active’).
- DS-004 Type filter
  - Steps: Choose types (e.g., PostgreSQL, MySQL, MSSQL…)
  - Expect: Only those types appear; combination with search works.
- DS-005 Scope filter
  - Steps: Choose Server-Level then Database-Level.
  - Expect: Connection config scope is honored; server-level sources appear only in server scope.
- DS-006 Advanced toggles
  - Steps: Toggle “Has Errors” and “Has Usage”.
  - Expect: Results shrink to those with error/usage metadata; switching off restores previous list.
- DS-007 Tag chips
  - Steps: Click multiple tags; verify OR semantics; repeat to unselect.
  - Expect: aria-pressed toggles; counts/paging update.
- DS-008 View mode + page size
  - Steps: Switch Grid/List; change per-page (12/24/48).
  - Expect: Rendering stable; pagination windows correct; page resets when size changes.
- DS-009 Pagination window
  - Steps: Navigate across pages; verify window function (… ellipses) correct.
  - Expect: Visible page buttons center around current page.

Data Sources — Bulk Operations
- DS-010 Bulk select
  - Steps: Select several cards (checkbox in top-left of each item).
  - Expect: Bulk bar shows count; “Test All”, “Sync All”, “Clear” enabled.
- DS-011 Bulk test
  - Steps: Click Test All.
  - Expect: Per-source tests triggered; overall alert shows succeeded/failed counts; statuses update.
- DS-012 Bulk sync
  - Steps: Click Sync All.
  - Expect: Sync starts; toasts show aggregated results; lastSyncAt updates; failures show clear error.

Data Sources — Card Actions
- DS-013 Test single
  - Steps: Click Test on a card; observe spinner; purposely test both valid and invalid creds.
  - Expect: Success toast and status=active for valid; failure toast and status=error for invalid; lastTestAt set.
- DS-014 Sync single
  - Steps: Click Sync; observe spinner and completion; re-trigger after success.
  - Expect: Toast includes databases/assets count if provided; lastSyncAt updates; syncStatus transitions running→completed.
- DS-015 Menu actions
  - Steps: Open kebab menu; Configure/Browse Databases/Delete.
  - Expect: Menu closes on outside click/Esc; Configure opens modal; Browse toggles DB list; Delete asks confirm then removes.
- DS-016 Tags/Usage blocks
  - Steps: Verify tags show +N more; usage block renders queriesCount/lastUsed only when present.
  - Expect: No UI jitter; long tag lists collapse until expanded.

Data Sources — Configure Modal
- DS-017 Open/Close
  - Steps: Open Configure; press Esc; click backdrop; click Close.
  - Expect: Modal closes and returns focus to trigger; state preserved unless saved.
- DS-018 Edit + Save
  - Steps: Change name/desc/tags/metadata; Save.
  - Expect: Save button shows spinner; success banner; modal closes; list updated.
- DS-019 Test in modal
  - Steps: Modify connection fields; Click Test Now.
  - Expect: Test banner shows success/failure; does not persist unless Save pressed.
- DS-020 Security/Advanced
  - Steps: Toggle SSL; adjust timeouts/pool; ensure numbers validate and persist.
  - Expect: Values reflected after Save and on re-open.

Data Sources — Add Connection Wizard
- DS-021 Open Wizard
  - Steps: Click Add Connection; choose PostgreSQL Server; fill host/port/user/password; (optional) database.
  - Expect: Field validation; examples apply values; defaults sensible.
- DS-022 Test connection
  - Steps: Click Test; valid creds → success; invalid → error string from server; check response time.
  - Expect: Friendly, actionable error messages; no crashes.
- DS-023 Create
  - Steps: Submit; verify new source shows with correct type/scope; immediately Test/Sync works.
  - Expect: No duplicate creation; optimistic UI reconciles with server values.

Data Sources — Browse Databases
- DS-024 Show/hide
  - Steps: Click Show Available Databases; loading indicator; results appear; click again to collapse.
  - Expect: State toggles; search term clears when collapsing.
- DS-025 Search
  - Steps: If >5 DBs, search box visible; filter by substring; Clear search.
  - Expect: Count chip reflects filtered/total; list updates dynamically.
- DS-026 System toggle and tooltips
  - Steps: Toggle show system DBs; hover badges.
  - Expect: System DBs show shield; sync disabled; tooltip explains why.
- DS-027 Per-DB Sync
  - Steps: Click sync icon for a user DB; observe spinner; re-open list; verify isSynced/assetCount/lastSyncAt update.
  - Expect: Toast shows number of assets created/updated; disabled during syncing.
- DS-028 Set scope from DB
  - Steps: Click database name text.
  - Expect: Global DB scope updates; confirm other views reflect selection if applicable.

API — Data Sources
- DS-API-001 List
  - Call: GET `/api/data-sources?page=1&limit=20&status=connected&type=postgresql`.
  - Expect: Envelope with data and pagination; status normalized in UI.
- DS-API-002 Test
  - Call: POST `/api/data-sources/:id/test`.
  - Expect: Normalized ConnectionTestResult (success/message/testedAt/connectionStatus/latency).
- DS-API-003 Sync
  - Call: POST `/api/data-sources/:id/sync` with and without `?database=...`.
  - Expect: Normalized SyncResult; fallback routes reachable if primary is absent.
- DS-API-004 List databases
  - Call: GET `/api/data-sources/:id/databases`.
  - Expect: Accepts string[], object[], or { databases } envelope; normalized in UI.

Data Catalog — Page and Filters
- DC-001 Initial load
  - Steps: Open Data Catalog; observe stats and initial assets page.
  - Expect: Summary shows totals; pagination correct.
- DC-002 Exclude system objects
  - Steps: Verify no `pg_catalog`, `information_schema`, `sys`, `msdb`, etc.
  - Expect: Only user objects by default (objectType=user).
- DC-003 Search
  - Steps: Search by table/schema/description; clear via X button.
  - Expect: Client list filters; server filters update via updateFilters; page resets to 1.
- DC-004 Data Source filter
  - Steps: Choose a source in dropdown; verify assets belong only to that source.
  - Expect: Both server and client filtering align.
- DC-005 Databases multi-select
  - Steps: Open database picker; choose several; Clear All.
  - Expect: Only selected databases shown; toggling updates `databases` query (comma-separated).
- DC-006 Schema filter
  - Steps: Select a schema from computed list.
  - Expect: Only assets from target schema; schema list honors current scope.
- DC-007 Type filter
  - Steps: All/Table/View; confirm counts on options match server summary when available.
  - Expect: Client/server alignment; pagination resets.
- DC-008 Views and pagination
  - Steps: Toggle Grid/Table/Compact; page through results.
  - Expect: No layout regressions; pagination works in all modes.
- DC-009 Clear all filters
  - Steps: Click Clear all filters.
  - Expect: Filters reset; page resets to 1; full results set returns.

Data Catalog — Asset Interactions
- DC-010 Card selection
  - Steps: Toggle selection on multiple cards; clear via header chip.
  - Expect: Count reflects; selection survives paging mode changes.
- DC-011 Bookmark
  - Steps: Toggle; check toast; reload and confirm persistence.
  - Expect: API `/bookmark` returns state; UI reflects.
- DC-012 Rate
  - Steps: Click stars; verify average rating update; reload list.
  - Expect: API `/rate` result used to update ratingAvg; shows on card and details panel.
- DC-013 Share
  - Steps: On browsers with navigator.share → native modal; otherwise link copied.
  - Expect: Notification indicates success; link includes `?asset=` deep link.
- DC-014 Export
  - Steps: Click Export with filters set.
  - Expect: Download triggers with current filters; shows toast.
- DC-015 Profile
  - Steps: Start profile; wait; refresh after delay.
  - Expect: Success toast then updated stats when job finishes.

Data Catalog — Details Panel
- DC-016 Open/Close
  - Steps: Click a card to open; backdrop click/Esc/Close button.
  - Expect: Panel appears from right; closes cleanly; focus returns.
- DC-017 Overview content
  - Steps: Verify DS name/database/schema/type/created/updated; trust score ring.
  - Expect: Values present and formatted; placeholders where missing.
- DC-018 Columns tab
  - Steps: Open Columns; triggers fetch once; shows count, PK/REQUIRED chips.
  - Expect: Loading state; empty state when none; errors logged without breaking panel.
- DC-019 Lineage tab
  - Steps: Open Lineage; confirm loading then graph/list appears.
  - Expect: Handles missing lineage gracefully.
- DC-020 Description edit/generate
  - Steps: Edit → Save; Generate → apply; close and reopen.
  - Expect: Persistence across refresh; success toasts; error handling visible.
- DC-021 Preview/Query
  - Steps: Preview returns rows/columns or error; Query shows generated SQL.
  - Expect: Clear message when not available; no crash.

API — Catalog
- DC-API-001 List assets
  - Call: GET `/api/catalog/assets?objectType=user&dataSourceId=...&databases=db1,db2&schema=...&type=table&search=text&page=1&limit=20`.
  - Expect: `assets[]`, `pagination`, optional `summary`; supports `datasourceId` alias.
- DC-API-002 Summary
  - Call: GET `/api/catalog/summary` with same filters.
  - Expect: Totals and byType align with list/pagination.
- DC-API-003 Databases
  - Call: GET `/api/catalog/databases?dataSourceId=...` or no param for all.
  - Expect: Per-source arrays with `{ name, isSystem, isSynced, lastSyncAt, assetCount }` and `systemDatabases`.

Accessibility/UX Smoke
- A11Y-001 Keyboard navigation focuses buttons, inputs, menus; Esc closes menus/panels.
- A11Y-002 Buttons/controls have visible labels/tooltips; check checkboxes/toggles have role and labels.
- A11Y-003 Loading/disabled states communicate progress/prevent duplicate actions.

