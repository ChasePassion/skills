---
name: log-build
description: Add or refine sparse, structured, file-persisted application logs for code changes. Use when implementing or modifying complex business logic, critical state transitions, validation or parsing flows, boundary interactions (HTTP, DB, cache, queue, filesystem, subprocess), retries, fallbacks, async jobs, concurrency, or background tasks. Reuse the project's existing logging infrastructure whenever possible. Do not use for trivial edits, simple obvious CRUD, blanket "log everything" requests, or low-value noise.
---

# Log-build

Add minimal, systematic, high-value logs that help humans and agents locate failures quickly.  
Goal: maximize **debugging value per log line**, not log count.

---

## Core policy

1. **Detect first** — check if the touched path actually needs logs.
2. **Reuse existing infrastructure** — logger, format, directory, level conventions.
3. **If no logger exists and the flow is non-trivial** — introduce the smallest shared setup (file-backed, timestamped, consistent format) instead of scattering ad hoc prints.
4. **Add few but decisive logs** at key nodes only.
5. **If the task is trivial with no meaningful log point — add nothing.**

---

## Where to log

Log at these control points only:

| Point | When |
|---|---|
| **Entry** | Medium/complex/async flows only (job started, import started) |
| **Decision** | Non-trivial branch: state transition, fallback selected, strategy switched, permission denied |
| **Boundary** | External call that can fail or slow: HTTP, DB write, cache (correctness), queue, filesystem, subprocess, SDK |
| **Data failure** | Parsing, validation, mapping, deserialization, type conversion failures |
| **Critical side effect** | Irreversible or important state change: order submitted, role changed, file persisted |
| **Reliability** | Retry, timeout, circuit breaker, dead letter, idempotency conflict, lock failure |
| **Completion summary** | One summary at the end of any medium/complex flow — highest-value log in the flow |

### Volume target

- **0 logs** — trivial work
- **1–3 logs** — one non-trivial flow
- **≤5 logs** — genuinely complex, async, cross-service, or high-risk flow

Prefer: one decision/transition log + one failure log + one completion summary, over many vague INFO lines.

---

## Where NOT to log

- Trivial getters, setters, pure functions, one-line transforms
- Every layer of the same call chain with the same message
- Hot loops or per-item verbose logs in large batches
- Every step of a simple CRUD path
- "Enter/leave function" noise or logs that only restate the code
- Raw large payload dumps
- Temporary debug prints (remove before committing)

---

## Log entry format

**Always follow the project's existing log format if one exists. The template below is the default when starting from scratch.**

Prefer structured logs: **JSON** if the project supports it, otherwise **`key=value` / logfmt**.  
One event per line.

### Template

Every entry has three parts in this order: **When · Where · What**

```
ts=<when>  module=<where>  event=<what>  message="<what>"  [additional fields]
```

Example:
```
ts=2025-03-25T14:32:15.123Z  module=checkout.payment  event=payment.charge_failed  message="Card rejected by provider"  order_id=9981  reason=insufficient_funds
```

---

### When

ISO 8601 · millisecond precision · UTC

```
ts=2025-03-25T14:32:15.123Z
```

Always UTC. Never local time unless the project already has an established convention.

---

### Where

`module=` mirrors the log file name exactly — no translation needed.

```
module=checkout.payment        →  checkout.payment.log
module=worker.import           →  worker.import.log
module=auth.login.oauth        →  auth.login.oauth.log
```

---

### What — three principles

1. **`event` for machines, `message` for humans** — `event` is a stable, grep-able name (`payment.charge_failed`); `message` is a plain-language sentence for the reader. Both are required, neither replaces the other.

2. **Outcome must be explicit** — the entry must make clear whether the operation succeeded, failed, or degraded. Describing that something happened without stating the result is not enough.

3. **Context sufficient, not exhaustive** — carry only the fields that help locate the problem. Do not dump entire objects or payloads.

### Event naming

Good: `quote.status_transition`, `payment.charge_retry`, `reconcile.mapping_failed`, `import.job_completed`  
Bad: `something happened`, `got here`, `debug step 2`, `error occurred`

---

## Level policy

If the project already has a level convention, follow it. If not, do not introduce one — a well-named event conveys severity on its own.

---

## Sensitive data policy

**Never log** passwords, tokens, API keys, session secrets, cookies, connection strings, full personal/payment data, raw request/response bodies. When in doubt, omit the field.

---

## File persistence & Git

If the project already writes logs to files, keep that setup.  
Otherwise, for non-trivial systems create a minimal default:

```
logs/app.log  (or logs/<service>.log)
append mode · timestamps · one event per line · UTF-8 · structured format
```

Rotation (daily or size-based) is preferred if available; append-only is acceptable as a minimum.

Update `.gitignore` if file-based logs are introduced and not already covered:

```gitignore
logs/
*.log
```

Or to keep the directory:

```gitignore
logs/*
!logs/.gitkeep
*.log
```

---

## File naming

File names serve humans first. The name should answer at a glance: **"what part of the system does this log belong to?"** Timestamps belong inside log entries, not in file names.

### Structure

```
<big>[.<mid>[.<small>]].log
```

- Levels separated by `.`, words within a level separated by `-`
- All lowercase
- Names mirror the actual module / feature / component names already in the codebase — no renaming

### Depth rules

| Project size / complexity | Typical result |
|---|---|
| Small or single-concern | `app.log` — one file is enough |
| Clear top-level modules | `auth.log`, `checkout.log`, `worker.log` |
| One module needs more detail | `checkout.payment.log`, `worker.import.log` |
| Fine-grained component/feature | `checkout.payment.card-form.log`, `auth.login.oauth-callback.log` |

Only go deeper when log volume or complexity genuinely warrants it. Depth does not need to be uniform across files.

### Applies universally

The same pattern works across stacks and project types:

| Context | Example |
|---|---|
| Backend service module | `order.fulfillment.log` |
| Background / async worker | `worker.email-digest.log` |
| Frontend page | `checkout.log` |
| Frontend component | `checkout.address-form.log` |
| CLI tool | `cli.migrate.log` |
| Mobile feature | `app.auth.biometric.log` |
| Scraper / crawler | `crawler.product-page.log` |

### Default when in doubt

If the project has no clear module split, start with `app.log`. Split into named files only when a specific module's logs are large enough or distinct enough to warrant it.

---

## Examples

```
ts=2025-03-25T14:32:15.123Z  module=checkout.payment  event=payment.charge_retry  message="Retrying card charge after timeout"  order_id=9981  attempt=2  duration_ms=340

ts=2025-03-25T14:32:18.456Z  module=checkout.payment  event=payment.charge_failed  message="Card charge failed, no more retries"  order_id=9981  reason=insufficient_funds  outcome=failed

ts=2025-03-25T14:33:01.789Z  module=worker.import  event=import.job_completed  message="CSV import finished"  job_id=42  total=500  success=498  failed=2  duration_ms=4200  result=partial

ts=2025-03-25T14:33:05.012Z  module=auth.login  event=auth.permission_denied  message="User lacks required role"  user_id=u_881  required_role=admin  outcome=denied
```

---

## Anti-patterns

- **Narrative logging** — prose messages instead of stable event names + fields
- **Duplicate stack logging** — same exception logged loudly at every layer; log where context is richest, propagate cleanly elsewhere
- **Raw payload dumping** — log a few key fields, not entire objects
- **Per-item batch spam** — use aggregated completion logs; reserve WARN/ERROR for failed items only
- **Console-only logs** — use file-backed logging for stable system logs

---

## Decision checklist

Before adding logs, verify:

1. **Inspect** — existing logger, format, fields, whether the path already has sufficient logs
2. **Identify** — only mark complex, failure-prone, state-changing, boundary-crossing, or async nodes
3. **Minimize** — choose the minimum useful set (transition + failure + summary)
4. **Stabilize** — logs must survive future debugging sessions; no throwaway commits

Before finishing, confirm:
- [ ] Logs added only where they genuinely help
- [ ] No duplicate or noisy logs
- [ ] Levels used only if the project already has a level convention; stable event names always
- [ ] Every entry has ts (ISO 8601 UTC ms) · module · event · message
- [ ] File persistence + append mode
- [ ] File named after the module/feature it belongs to (`<big>.<mid>.<small>.log`), no dates in filename
- [ ] `.gitignore` covers log files
- [ ] No secrets or sensitive data
- [ ] Existing conventions respected

---

## Reporting

After adding or modifying logs, briefly tell the user in natural language:
- which files were touched
- where exactly logs were added and why
- if no logs were added, say so and why

Keep it short — a few sentences is enough.

---



Prefer **no log** over a bad log.  
Prefer **one decisive summary** over many vague lines.  
Prefer **shared infrastructure** over ad hoc prints.  
Prefer **stable event names + fields** over prose.  
Prefer **sanitized context** over raw payloads.

The correct outcome may be: add nothing · add a few logs · refactor noisy existing logs · introduce a minimal shared file-backed logger.