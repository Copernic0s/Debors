# Debors CMP automation on Windows

These scripts target Windows PowerShell 5.1 and run the local CMP worker in the signed-in user's session. They do not register tasks unless `register-tasks.ps1` is explicitly invoked without `-WhatIf`.

## Manual checks

Open PowerShell as the Windows user who owns the CMP Chrome profile and run from the repository root:

```powershell
.scripts\windows\start-server.ps1
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

`start-server.ps1` returns if the API is healthy, detects an existing Debors server process before launching another, and starts Node hidden if needed. Standard output goes to `logs/server-<timestamp>.log`; standard error is kept in the matching `-error.log`. The scripts load environment settings from the root `.env` by default. If the file lives elsewhere, pass its path with `-EnvFile`; `register-tasks.ps1` stores only that path in each task action. The sync script checks only the health response's `cmpIngestSecret` boolean; `/api/cmp/run` requires the server to have that value configured but does not require the caller to send the secret. The secret is inherited by the local Node process only; it is never put in task arguments or logs.

To manually start a scheduled-style run, use:

```powershell
.scripts\windows\run-cmp-sync.ps1 -Depth fast
```

This command really launches the CMP bot, so use it only when ready for a real sync. It exits `0` only when the matching run is complete and persisted. An active run is not duplicated. `-Depth normal` and `-Depth deep` are available for manual use. A run that ends with `session_expired` or `mfa_required` creates `logs/cmp-session-expired.flag`; scheduled invocations then stop before starting the server or contacting CMP. After logging into CMP and completing a successful manual **Sync All**, the backend removes the flag. Alternatively remove it explicitly:

```powershell
Remove-Item .\logs\cmp-session-expired.flag
```

An optional webhook can be set as `NOTIFY_WEBHOOK_URL` in the process environment or root `.env`. It receives only an event name, failure reason, depth, and timestamp; never credentials or invoice details. Notification delivery failure does not change the sync result.

## Scheduled tasks

Preview the five task definitions first. This does not register them:

```powershell
.scripts\windows\register-tasks.ps1 -WhatIf
```

Register or update tasks idempotently:

```powershell
.scripts\windows\register-tasks.ps1
```

For the existing env file in another checkout, pass its path (no values are copied into task definitions):

```powershell
.scripts\windows\register-tasks.ps1 -EnvFile "C:\path\to\Debors\.env"
```

Remove all Debors tasks:

```powershell
.scripts\windows\register-tasks.ps1 -Unregister
```

`Debors-Server` runs at user logon. Fast syncs run daily at 08:00, 12:00, and 16:00; normal sync runs at 19:00, using Windows local time. Tasks use an interactive principal and run only while that user is signed in. Multiple instances are ignored, missed starts are allowed to run later, wake-to-run is enabled, the execution limit is one hour, and tasks may continue on battery.

## Workstation requirements and risks

- Keep the PC powered on and signed in at scheduled times. Wake-to-run depends on Windows power settings and hardware; test it on this machine.
- Prefer AC power. Configure sleep so the machine remains awake for the planned run windows; the display may turn off. Do not rely on wake-from-hibernate unless verified.
- Keep the CMP Chrome profile available and authenticated. Scheduled runs do not bypass MFA. If the session expires or MFA is required, the flag pauses further scheduled runs until a successful manual Sync All or manual flag removal.
- Each depth now permits up to 1,000 pages at 500 rows per page to cover the 433,812-row CMP inventory observed on 2026-11-17. A full scan can take several hours; the scheduled task's one-hour execution limit is therefore insufficient. Do not register these tasks until the CMP query is optimized or the task timeout and schedule are deliberately redesigned. Truncation remains incomplete and cannot reconcile the snapshot.
- This is workstation automation, not a cloud scheduler: shutdown, sign-out, network loss, Chrome profile locks, or CMP changes can delay or fail syncs.
- Logs and flags are local operational data under `logs/`, excluded from Git. The invoice extractor's per-run logs remain under `automation/logs/` and are also ignored.

## Tests

Run the helper tests without registering any tasks or starting the bot:

```powershell
Invoke-Pester .\scripts\windows\tests\sync-helpers.Tests.ps1
```
