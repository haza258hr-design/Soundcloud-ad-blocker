# Changelog

## 1.2.0 — 2026-09-29

- Preserve the 1.1.0 audio-ad request rule and explicit player-state detector.
- Live popup status, readable controls, and one-click pause with owned-mute restoration.
- Opt-in event diagnostics, clear-history control and report-sharing privacy warnings.
- Portable tests with no external workspace fixtures.
- Dependency-free, allowlisted release ZIPs with SHA-256 checksums.
- GitHub CI, issue template, contribution/release instructions and MIT license.

## 1.1.0 — 2026-09-28

- Replace guessed ad domains and short-track heuristics with the researched audio-ad endpoint and is-adPlaying state.
- Fix invalid browser ResourceType values.
- Own and restore tab mute without overriding user mute settings.
- Add rule self-test and sanitized session diagnostics.
- User reported this version worked well on 2026-09-29. This is user feedback, not a broad compatibility study.

## 1.0.x — superseded

Early versions missed live ads. Do not use them; see RESEARCH.md for the failure audit.
