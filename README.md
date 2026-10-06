# Inactive Users

NodeBB plugin under development for NodeBB 4.16.1.

The public repository is https://github.com/MagicMirrorOrg/nodebb-plugin-inactive-users.

## Agreed behavior

Select users after six calendar months without activity. The period is configurable.
Use `lastonline`. If a user was never active, use `joindate`.
Include administrators and moderators.

Provide three independent actions:

- Disable digests.
- Disable email notifications while preserving forum notifications.
- Revoke email confirmation without removing the address.

Enable all three actions by default. Enable dryrun by default.
Dryrun shows proposed changes without changing accounts.

Support manual execution and optional nightly execution at 03:00 in the forum timezone.
Disable nightly execution by default.

Preserve accounts, posts, privileges, and sessions. Do not restore mail preferences automatically.
Use the existing NodeBB confirmation behavior. Do not add a login confirmation screen.
This plugin does not process SES bounces or complaints.

## Development status

The first group implements settings normalization and inactivity selection with targeted backend tests.
The NodeBB integration, action runner, report, and scheduler are not implemented yet.
Do not install this repository on a live forum yet.

Run the backend tests with `npm test`.

## Decisions and follow-up

Calendar month calculations use UTC to keep selection consistent across servers.
The scheduler timezone source still requires inspection of the NodeBB configuration.
No code is deployed to the MagicMirror server.

Next task: connect settings and batched user selection to NodeBB APIs.
