# Contributing

Use Node.js 22 or newer. There are no npm dependencies and no install step.

```sh
npm test
npm run build
```

Keep permissions narrow. Do not add title keywords, duration guesses or broad ad-domain lists without source evidence and false-positive tests. Never upload a browser profile, diagnostic report, private workspace history or credentials.

Tests simulate browser APIs; also load the extension unpacked and run the manual checklist in RELEASE.md. Tests must work from a standalone clone, not depend on parent folders. The historical 1.0.4 enum regression uses a minimal reproduction rather than shipping the old implementation.

When changing behavior, add a regression, update CHANGELOG.md and keep package.json and manifest.json versions identical. Release packaging is an explicit file allowlist in scripts/build.mjs. Add any required runtime assets there and to manifest validation.

Public issues should contain only reviewed, sanitized details. For a potential security issue, use the repository's private vulnerability reporting option if enabled; otherwise ask the maintainer for a private channel without posting exploit details or sensitive logs.
