# Inactive User Email Controls

## Feature Description

Create a standalone plugin for NodeBB 4.16.1 in `MagicMirrorOrg/nodebb-plugin-inactive-users`.
Select users after the configured number of calendar months without activity. The default is six months.
Use `lastonline`. If the user was never active, use `joindate`.
Include administrators and moderators. Preserve accounts, posts, privileges, and sessions.
Provide independent controls to disable digests, disable email notifications, and revoke email confirmation.
Do not process SES feedback. Do not add a custom login confirmation flow.
Keep dryrun enabled by default. Keep automatic execution disabled by default.
Support manual execution and optional nightly execution at 03:00 in the forum timezone.
Enable all three actions by default. Show accounts, last activity, actions, and totals in the report.
Check the forum timezone source before the scheduler implementation.

## User Flow Examples

When an administrator runs a dryrun, the report shows affected accounts and proposed actions without account changes.
When dryrun is disabled, a manual or nightly run applies only enabled actions to inactive users.
When a user returns, NodeBB retains its existing confirmation behavior. The plugin does not restore mail preferences.

## Required Changes

### Sub-feature 1: Plugin Settings and User Selection

**Backend:**

- [x] Create the plugin manifest and package metadata using NodeBB plugin conventions.
- [x] Store the inactivity period, three action switches, dryrun switch, and nightly execution switch through `meta.settings`.
- [x] Select users in batches through NodeBB database APIs using `lastonline` and the `joindate` fallback.
- [x] Define the calendar-month cutoff and include all user roles.

**Backend Tests:**

- [x] Check the cutoff boundary, calendar month boundaries, and never-active users.
- [x] Check that administrators and moderators follow the same selection rules.

**UI:**

- [ ] Add a native administration page with the agreed settings.

### Sub-feature 2: Dryrun Report and Independent Actions

**Backend:**

- [ ] Share selection and action decisions between dryrun and apply mode.
- [ ] Disable digests through NodeBB settings and update digest subscription indexes.
- [ ] Remove email delivery from notification preferences while preserving forum notifications.
- [ ] Revoke email confirmation and synchronize verified and unverified groups without removing the email address.
- [ ] Check active confirmation links so an old link cannot undo revoked confirmation.
- [ ] Apply only enabled actions and report only actual proposed changes.
- [ ] Check activity again before each account change and prevent overlapping runs.
- [ ] Preserve account access, content, privileges, and sessions. Do not send cleanup emails.

**Backend Tests:**

- [ ] Check that dryrun makes no account, settings, group, or subscription changes and sends no emails.
- [ ] Check each action independently and confirm that disabled actions preserve their fields.
- [ ] Check repeated execution and users who become active before an apply action.
- [ ] Check that email-only notifications become disabled and combined notifications retain forum delivery.

**UI:**

- [ ] Show affected accounts, last activity, and proposed or completed actions in a paginated report.
- [ ] Label dryrun and apply mode clearly and show run progress and results.

### Sub-feature 3: Manual and Nightly Execution

**Backend:**

- [ ] Use the same runner for manual execution and nightly execution.
- [ ] Run nightly at 03:00 in the agreed forum timezone when enabled.
- [ ] Respect dryrun during scheduled execution and prevent duplicate scheduling across NodeBB processes.
- [ ] Use NodeBB resource routes and administrator permissions for settings, execution, and reports.

**Backend Tests:**

- [ ] Check that scheduling remains disabled by default and manual execution remains available.
- [ ] Check timezone behavior, process coordination, and administrator access controls.

**UI:**

- [ ] Add a manual run button and display the nightly schedule and effective timezone.
- [ ] Document installation, settings, dryrun, and the limits of email-confirmation revocation in the README.
