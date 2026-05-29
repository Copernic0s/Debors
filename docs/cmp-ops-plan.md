# CMP Ops Project Plan

## Goal

Build a separate operational dashboard for CMP-owned access data and card state, without mixing it into the existing debtors/invoicing flow.

This project is for:

- owner credentials and access details
- company-linked email / username / password lookup
- card status per account
- change tracking and refreshable snapshots
- permission-aware display in the app

## Why This Should Be Separate

- The current Debtors app is centered on invoices, collections, and operational debt tracking.
- CMP credentials and card status are sensitive, volatile, and should follow different access rules.
- Card state changes more often than invoices, so it needs its own sync cadence and UI.
- Separating the feature reduces regression risk in the current invoice flow.

## Suggested Architecture

### Data Layers

1. `cmp_owner_access`
   - company
   - owner name
   - owner email
   - username
   - password reference or encrypted value
   - last synced at
   - source metadata

2. `cmp_card_status`
   - company
   - account or card identifier
   - current status
   - last seen status
   - last synced at
   - source metadata

3. `cmp_sync_audit`
   - sync run id
   - source
   - run type
   - started at
   - ended at
   - records found
   - records updated
   - error if any

### Sync Services

- One worker for owner/access data.
- One worker for card status.
- One lightweight orchestrator to coordinate runs and prevent overlap.
- Keep invoice sync and ops sync separate.

### Hermes Layer

Use `Hermes` as the orchestration layer name if you want a single coordinator that:

- decides which sync runs next
- prevents overlapping Chrome sessions
- retries failed fetches with backoff
- records audit events
- dispatches worker jobs to the owner/access and card-status pipelines

If `Hermes` becomes a real module, keep it thin. It should coordinate, not scrape.

### UI Surfaces

- Dashboard tab for `CMP Ops`.
- Company detail drawer for access and card state.
- Copy actions for email / username / password where allowed.
- Status chips for card state changes.
- Last sync timestamp and source indicators.

## Security Rules

- Never display passwords by default.
- Show password only after explicit user action and permission check.
- Do not store raw password in the browser state longer than necessary.
- Keep service-role writes server-side only.
- Log access events if the business requires auditability.
- If possible, store secrets encrypted or tokenized, not plain text.

## Implementation Plan

### Phase 1. Discovery

1. Inspect the CMP `User management` tab and card/account screens.
2. Identify stable selectors for owner rows, email, password reveal action, and card status cells.
3. Decide whether data is sourced from:
   - direct browser scraping
   - a backend worker
   - both
4. Define the canonical company key used to join this data to Debtors.

### Phase 2. Data Model

1. Create Supabase tables for owner access and card status.
2. Add timestamps and source columns.
3. Add row-level access rules.
4. Add indexes for company lookup and latest sync queries.
5. Decide how password values are stored:
   - encrypted storage
   - masked storage
   - reference-only storage

### Phase 3. Worker Design

1. Build a dedicated sync worker for CMP Ops.
2. Reuse the existing Chrome debugger/session pattern only if it is stable enough.
3. If the current Chrome session is fragile, isolate the Ops worker from the invoice worker.
4. Add watchdog logic:
   - detect no-progress states
   - detect stale browser sessions
   - restart the worker on timeout
5. Record each run in `cmp_sync_audit`.

### Phase 4. Frontend Integration

1. Add a new dashboard view for CMP Ops.
2. Add company search and filters.
3. Add row/detail drawer for access info.
4. Add card status list and change highlights.
5. Add copy buttons and reveal controls with tooltips.
6. Keep the UI dense, operational, and scan-friendly.

### Phase 5. Notifications

1. Notify when a sync starts.
2. Notify when a company access record changes.
3. Notify when a card status changes.
4. Notify when a worker stalls, times out, or restarts.
5. Show “last refreshed” and “stale data” indicators in the UI.

### Phase 6. Tests

1. Unit tests for:
   - company key normalization
   - status mapping
   - masking / reveal logic
   - aggregation rules
2. Integration tests for:
   - snapshot ingest
   - Supabase upserts
   - UI refresh after worker updates
3. Worker tests for:
   - selector extraction
   - retry behavior
   - timeout recovery
   - no-progress detection
4. Manual verification:
   - copy button behavior
   - password reveal flow
   - card status update flow
   - refresh without F5

## Suggested Workflow For The Next Week

### Day 1

- Finalize scope.
- Confirm tables and field names.
- Decide security model for passwords.

### Day 2

- Build the Supabase schema.
- Add seed or migration SQL.
- Add indexes and policies.

### Day 3

- Implement the worker skeleton.
- Add audit logging.
- Validate browser attachment and retry flow.

### Day 4

- Build the dashboard UI shell.
- Add company search, detail drawer, and status chips.

### Day 5

- Connect worker to UI data.
- Add refresh behavior.
- Add notifications.

### Day 6

- Write tests.
- Fix edge cases.
- Verify permissions and masking.

### Day 7

- End-to-end validation.
- Performance review.
- Cleanup and documentation.

## Agent Workflow

When resuming this project with Codex:

1. Read this plan first.
2. Inspect the current repo state before editing.
3. Use the relevant local skills for the task.
4. Prefer small, verifiable changes.
5. Run tests after each meaningful milestone.
6. Update the plan file as the scope changes.
7. Document any blockers immediately instead of working around them silently.

## Notes On Skills / Tools

- Use the frontend design skill when building the new dashboard surface.
- Use GitHub skills when preparing commits or PRs.
- Use browser verification when the UI changes.
- Use local shell checks for build and lint validation.
- Keep test commands explicit and repeatable.

## Open Questions

- Should passwords be stored as encrypted values or only as a reveal-through-worker action?
- Should card status be refreshed on a timer or only on demand?
- Should the Ops dashboard live inside Debtors as a new tab or be its own route?
- Should this feature be role-gated to a smaller set of users than the rest of Debtors?

## Success Criteria

- Users can find owner login data without searching CMP manually.
- Users can see card status changes without relying on a fresh F5.
- The dashboard remains separate from invoice logic.
- Sensitive data stays permissioned and auditable.
- The sync process survives background Chrome instability better than the current flow.
