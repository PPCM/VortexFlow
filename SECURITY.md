# Security Policy

## Supported versions

VortexFlow currently has a single active branch (`main`). Only the latest
commit on `main` receives security fixes. There are no released versions or
maintenance branches.

## Reporting a vulnerability

**Please do not open a public GitHub issue or pull request for a security
vulnerability.**

Instead, email the maintainer with the details:

- **Contact:** [pierre@redtrash.fr](mailto:pierre@redtrash.fr)
- **Subject:** `[VortexFlow security]` followed by a one-line summary

Include in your report:

- The commit hash you tested against (`git rev-parse HEAD`).
- A description of the vulnerability and its impact.
- Steps to reproduce, ideally with a minimal proof-of-concept.
- Any suggested mitigation, if you have one.

## Response timeline

This is a small project with a single active maintainer; responses are
best-effort.

| Step | Target |
|---|---|
| Acknowledgement of receipt | within 7 days |
| Initial assessment | within 14 days |
| Fix or mitigation plan communicated to reporter | within 30 days |
| Public disclosure (after a fix is shipped) | coordinated with reporter |

## Scope

In scope:

- The `backend/` Express API and its session handling
- The `frontend/` React application
- The DOT validator and parser
- Build / deployment configuration committed in this repository

Out of scope:

- Third-party dependencies (please report upstream and let us know)
- Issues that require physical access to a user's machine
- Social engineering or denial-of-service against the maintainer
- Findings on the dev host hardcoded in scripts (`192.168.5.30`) — that's a
  local-only address, not a deployed instance

## Acknowledgements

If your report leads to a fix, you'll be credited (with your consent) in the
relevant changelog entry under `doc/changelog/`.
