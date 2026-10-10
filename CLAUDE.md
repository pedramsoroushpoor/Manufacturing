# Manufacturing GNG+ (سیستم تولید پلاس)

Full project spec, state and decisions: [Manufacturing-GNG-Plus.md](Manufacturing-GNG-Plus.md) — read it before starting any form. Keep it up to date when a form is delivered (sections 4, 5, 7, 9, 13).

## Layout
- `gng-mfr-api` — Node + Express + `mssql`, port 4311, single file `server.js`. Install scripts in `scripts/mes_frm_<form>_setup.sql` (idempotent, run in order). `cl_frm_*.sql` are obsolete — never run.
- `gng-mfr-app` — Angular 18 standalone + PrimeNG 17, RTL Persian, port 4400.
- DB: local SQL Server 2022, database `MNG_System`, connection in `gng-mfr-api/.env` (never print the password).

## Running
- API: `cd gng-mfr-api; node server.js` — `dotenv` reads `.env` from the **current directory**, so start it from inside `gng-mfr-api`. Restart after every `server.js` change.
- App: `cd gng-mfr-app; npx ng serve --port 4400 --host 0.0.0.0` (watch mode, no restart needed).
- Checks: `node smoke-test.js` in `gng-mfr-api` (login/session/logout, 6 tests). RM bundles need a scope: `?orgNodeId=1` (root = گلرنگ), or `lineId`, or `lineId+stationId`; org-tree rows use `OrgNodeId`, not `id`.

## Rules (summary — details in the spec, section 3)
- New tables only in schema `mes`. Before creating one, look for the same table in `mfr` / `generalmfr` and reuse its name and columns (keep old typos), adding fields only where needed.
- Every `mes` table ends with the 11 standard columns (CompanyId … RowVersion); every procedure filters `IsDeleted = 0`; IDs returned as `INT`.
- Table/procedure names never come from the browser; values always parameterised. `/api/_inspect` uses a server-side key registry.
- Phase 1 forms: required features only, read-only (toolbar buttons visible but inactive).
- Each implemented form = four files `frm-xx-0N.{data.ts,service.ts,component.ts,component.html}` + registration in `features/forms/data/forms-registry.ts`.
- On delivery: set `alm.FormFeatureMapping.DevStatusCode = 'InProgress'` (keyed by `FormCode`, `FeatureCode`) and write in `Note` what is done and what remains. `Delivered` only once create/edit is complete.
- Order everything right-to-left; the org tree filter always sits on the right.
- Delivery steps: spec section 14.

- Decided (2026-10-07): a work station belongs to exactly one line (`WorkCenter.ProductionLineId`); resources shared across lines are modelled as a resource group, never a shared station.
- `mes.GetCapacityLoadInScope` uses `INSERT … EXEC` internally, so it cannot itself be wrapped in `INSERT … EXEC`; call it directly.

- Decided (2026-10-07): production contractors are, for now, independent tables (`mes.ProductionContractor*`), not outsourced lines/stations in the org tree. RM-08's side panel is a contractor list, not the org tree. May be revisited (spec open decision 12).

- Decided (2026-10-07): a form whose features are all non-required stays a prototype in phase 1 — unless the user explicitly asks for it. RM-09, PE-07 and ME-10 were built on request (2026-10-09).

- `mes.Product` is the temporary stand-in for the inventory item catalog (Id = ProductId). The `AshaERP_Dev*` databases on the same server belong to a different system — do not couple to them.
- `features/forms/pe/frm-pe-01.data.ts` also exports `FieldItem`, imported by the PE/ME prototypes. Always Read a prototype file before replacing it — other prototypes may import from it.

- FRM-PE-02 is the central form and the user expects several improvement rounds on it — keep its data model on the old `ProductStructure*` tables so later rounds don't change tables.
- In phase 1, read-only actions inside a form (diff, export) are implemented live; write actions (copy, import, conversions) wait for create/edit.

- `mes.GetEcoImpact` uses `INSERT … EXEC mes.GetWhereUsed`; same nesting limit as above.
- Decided (2026-10-09): substitutes are independent many-to-many groups (`mes.SubstituteGroup*`), not the old `ProductStructureItemSub`. ECO tables (`mes.EngineeringChangeOrder*`) are PE-only for now, not shared with PF-02 (revisit when PF-02 is built).
- RM, PE and ME domains are complete for phase 1 (2026-10-09): all 28 forms on real data.
- ME forms share `features/forms/me/me-routing.ts` (routing row, temp codes, side tree). Company-wide bundles in `server.js` use the `companyBundle({...})` helper (each key = a procedure taking only `@CompanyId`).
- `mfr.ProductionVersion` is a *planning* version, so the structure+routing bridge is the new `mes.ManufacturingVersion` (spec open decision 15).
- Browser-testing new endpoints while the user's API (4311) is old: run a temp API (`$env:API_PORT='4312'; node server.js` in background), set a 4311 session in `sessionStorage`, then in the tab patch XHR/fetch to send only the new paths to 4312 **without** the `x-alm-session` header (4312 rejects unknown tokens) and navigate with `history.pushState` + `popstate` (a reload drops the patch).

- PC domain done (2026-10-09/10), all 12 forms read-only by user decision (DB fidelity to old `WorkOrder*` tables matters more than writes here). Scripts `mes_frm_pc01..pc12` build one integrated scenario day; seeds are chained (pc04 → pc05 → pc06 …), so re-seeding a step means clearing and re-running all later steps. "Now" = `mes.fnShopNow()` = 2026-10-09 11:30 (frontend `SHOP_NOW` in `pc/pc-shared.ts`). `mes.MaterialStock` is the temporary stock stand-in. PC bundles use the `companySets({...})` helper (multi-recordset procs as `[proc, [names]]`).
- `mes.GetLiveExceptions` uses `INSERT … EXEC mes.GetConsumptionVariance`; same nesting limit.
- Deviation causes reuse the old `mes.ProductionPlanDeviation` tree (RM-07); do not build a second cause tree.
- The app uses `fetch` (HttpClient withFetch): browser tests patch `window.fetch` via an injected `<script>` (the JS tool runs in an isolated world), and live-reload drops the patch.
- Frontend loops over time axes must guard against a zero start time (PC-05 froze the page looping from 1970).

- BI forms (user request, 2026-10-09/10): FRM-PC-13 (weekly production-control meeting room), FRM-PE-10 and FRM-ME-11 (engineering observatories), menus 45013/43010/44011. Each is a large form split into a pure engine file + child components in a subfolder (`pc/pc13/`, `pe/pe10/`, `me/me11/`) — a deliberate exception to the four-file rule.
- Repo: https://github.com/pedramsoroushpoor/Manufacturing (branch `main`); git at `C:\Program Files\Git\cmd\git.exe` (not on PATH in Claude's shell). Root `.gitignore` keeps `.env` and `gng-mfr.connections.json` out.

## Next
User should restart `run-api.bat` once (4311 doesn't have the ME/PE-07/PC endpoints yet). Next: PF domain or the create/edit phase — user's choice. PE-02 and PC improvement rounds on user feedback. See spec section 13.
