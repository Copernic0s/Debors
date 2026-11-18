# CMP Open-Invoice Sync: Evidence and Proposed Design

**Scope:** read-only extractor diagnosis plus a proposal only. No scraper behavior, schema, policies, remote database, or bot was changed or executed for this design.

## Extractor Evidence

The newest local per-run log is `automation/logs/cmp-01fe7c97-0239-4e6d-94d4-5fa2c7ee85fb.log` (2026-11-18). Its page-size check records:

- Requested `limit=500`.
- URL retained `page=1&limit=500`.
- Pagination text was `1-500 of 433812 items`.
- The visible table held 500 raw rows.
- The page-size check passed (`valid=True`). The page-size dropdown itself was not detected (`selected=[]`), so the verifier passed using URL, pagination range, and raw row count.
- Pages 1-20 each had exactly 500 raw rows: 10,000 raw rows total. Extracted portfolio matches totaled 351.
- CMP pages 1-20 therefore represent about 2.3% of the 868 pages implied by 433,812 / 500. That is why this Fast run cannot be considered a full inventory.

The prior `8f2fc28b-189b-464f-b0c5-9f3166b9d286` log reached page 215 and likewise logged 500 raw rows on every page. Earlier failure run `423b8240-2be2-4ef2-9993-aea73582a3a4` logged only 10 raw rows/page when CMP did not honor the requested size.

**Effective limit conclusion:** 500 rows/page is the largest size evidenced by these logs and is confirmed working. The logs do **not** prove whether CMP accepts more than 500. Do not assume a higher limit; any test above 500 would need a controlled page-size check and must not be run as part of this read-only task.

Relevant implementation: [`automation/cmp_invoice_extractor.py`](../automation/cmp_invoice_extractor.py) requests `limit=500`, validates URL/pagination/raw rows, and logs raw rows separately from portfolio matches. Fast remains capped at 20 pages by [`server/cmpRunner.js`](../server/cmpRunner.js).

## Proposed Two-Pass Mode

The dashboard target is a union, not a single date window:

1. Every invoice with positive remaining balance, regardless of age.
2. Recently paid/closed invoices selected by `last payment date`, including invoices issued long ago.

Do not implement until the owner confirms the actual CMP filter controls and their semantics. In particular confirm whether the UI can filter `remaining amount > 0`, paid/closed status, and a date range on `last payment date`, and whether the result count changes to match those filters.

### Pass A: Open Balances

- Apply CMP's verified positive-balance/open-status filter.
- Keep the local extractor invariant `remaining_amount > 0` regardless of invoice age; compare CMP's displayed balance with the parsed balance.
- Traverse to the actual final page, not a fixed sample. Record raw rows, eligible rows, expected result count, page-size proof, and terminal-pagination proof.
- Mark this pass complete only if authentication stayed valid, every page transitioned, no page-size fallback occurred, no page failed, final page was reached, and observed raw rows reconcile with the count shown by the filtered CMP result. An unexplained zero result is incomplete, not empty-complete.

### Pass B: Recent Payments

- Filter to paid/closed rows with `last payment date` within an explicit window (proposed initial window: 15 days, subject to owner confirmation).
- Persist the source value in an additive nullable `public.cmp_invoices.last_payment_date` date column. Extractor parsing, timezone/date interpretation, null behavior, and CMP UI filter semantics must be tested before rollout. No migration is included in this work.
- Traverse the entire filtered result set. Complete only when the filter is visibly active, the reported count is known, every page succeeds, page size is verified, and all expected rows are accounted for. If CMP cannot expose a count or reliable terminal page, the pass cannot authorize reconciliation.
- A payment-date window must not use `invoice_date` as a substitute. An old invoice paid today belongs in this pass.

## Combined Completion and Reconciliation

Treat the two passes as children of one logical sync cycle with a shared cycle ID and explicit pass type. Upsert observed rows idempotently by invoice ID in either pass. The cycle is complete only when **both** pass contracts are complete; one complete pass cannot mask the other's failure.

Reconciliation may run only after the full target union is covered and validated:

- Upsert the union of open-balance rows and recent-payment rows first.
- Reconcile only previously current rows whose prior attributes place them in the target union: positive balance, or paid/closed with `last_payment_date` inside the selected window.
- Mark an eligible target row not seen in the complete union as no longer current with `closed_at`; never `DELETE`.
- Do not close rows with missing/ambiguous payment date based only on absence from Pass B. Resolve them through an all-closed scan or retain them current and report them as unknown until trustworthy coverage exists.
- If either pass is failed, truncated, count-mismatched, empty unexpectedly, or page-size-invalid, upserts may be retained but the cycle is incomplete and **no reconciliation runs**.
- Keep prior ratio guards as secondary protection, not as a replacement for filter/count/page completeness. A high row ratio alone cannot prove that a payment-date filter covered its intended set.

## Approval Gate

Before implementation, confirm from the CMP UI:

- Exact filter labels and accepted values for remaining balance and payment status.
- Whether `last payment date` is filterable and what timezone/date semantics CMP uses.
- Whether each filtered view exposes a stable total count and a deterministic final page.
- Whether the target payment window should be 15 days or another period.

Until confirmed, keep the current scraper unchanged and do not claim a Fast run refreshed all current invoices.
