# Inactive Users

Email controls for inactive NodeBB users. Targets NodeBB 4.16.1 and Node.js 20 or later.

## Behavior

The plugin selects accounts after six calendar months without activity. You can change the period.
It uses `lastonline`. If the user was never active, it uses `joindate`.
Accounts exactly at the cutoff stay active. Calendar month calculations use UTC.
Administrators and moderators follow the same rules.

Three independent settings control the changes:

| Setting | Change |
| --- | --- |
| Disable digests | Set the digest preference to off and remove digest subscriptions. |
| Disable email notifications | Remove email delivery. Preserve existing forum notification delivery. |
| Mark email addresses as unconfirmed | Keep the address, clear confirmation, update verification groups, and expire old confirmation links. |

All three settings start enabled. **Dryrun starts enabled. Nightly execution starts disabled.**
Dryrun stores a report without changes to accounts, preferences, subscriptions, or verification groups.
Manual and nightly runs use the same settings and account actions.

The plugin preserves accounts, posts, privileges, and sessions. It does not restore mail preferences when users return.
Email confirmation uses the existing NodeBB flow. This plugin does not require confirmation at login.
It does not disable accounts or protect an old moderator account against access.
It does not process SES bounces or complaints, validate addresses, or block password-reset emails.

## Installation

Install from the public Git repository in the NodeBB directory:

```sh
npm install github:MagicMirrorOrg/nodebb-plugin-inactive-users#v0.1.0
./nodebb activate nodebb-plugin-inactive-users
./nodebb build
./nodebb restart
```

A forum administrator must perform these steps. This repository does not install the plugin on MagicMirror.
Keep the plugin in the forum installation procedure so a platform reinstall restores it.
The package is not published to npm.

## Use

1. Open **Admin → Plugins → Inactive Users**.
2. Set the inactivity period and account actions.
3. Keep **Dryrun** enabled and select **Run manually**.
4. Check the report and action totals. The report includes administrators and moderators.
5. If the proposed changes are correct, clear **Dryrun** and run again.
6. Enable **Run every night** when automatic execution is required.

The manual button saves the displayed settings before the run starts.
Nightly execution runs at 03:00 in the NodeBB server timezone. The page displays that timezone.
The MagicMirror server used UTC during development. The schedule requires NodeBB `runJobs` on its primary process.
NodeBB must have one primary process. Manual requests use its existing pubsub transport.

Each run replaces the previous report. Reports contain 50 users per page and show progress, actions, results, and totals.
A failed action can leave partial changes. Completed actions appear in the report. Check failed rows before another run.
If NodeBB restarts during a run, the report becomes interrupted. Start a new run to process remaining accounts.
The runner checks activity again before each account action. Runs cannot overlap on the primary process.

Other plugins can send email outside NodeBB notification preferences. Check those plugins separately.
If a user enables email again, the next run applies the selected actions if the account remains inactive.
New notification types follow the same rule on the next run.

## Development

Use Node.js 22.13 or later for development checks.

```sh
npm ci
npm test
npm run test:coverage
npm run lint
```

The backend tests use NodeBB API doubles. They check account writes, administrator access, calendar cutoffs, reports, and process coordination.
They do not replace a dryrun on a test forum with the same NodeBB version and plugins.
No frontend tests are included. The administration template uses native NodeBB Bootstrap components.

## Decisions and follow-up

Settings use NodeBB `meta.settings`. Reports use NodeBB database APIs. The latest report is retained.
The primary process owns execution. The native NodeBB cron service owns the schedule.
There is no external service, AWS dependency, or production deployment in this repository.

Known limits: actions are not a database transaction, and reports have no history export.
No additional technical debt is known beyond these documented limits.
Next task: install on a test forum and check a manual dryrun before production use.
