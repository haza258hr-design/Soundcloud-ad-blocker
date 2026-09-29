# SoundCloud Mid-Roll Guard

A lightweight Brave/Chromium extension that blocks SoundCloud audio-ad requests, with automatic ad muting and available-skip fallback. No account, backend, subscriptions, or runtime dependencies.

## Install in Brave

1. Download **soundcloud-midroll-guard-v1.2.0.zip** from this repository's Releases.
2. Extract it to a permanent folder. Do not delete or move that folder afterwards.
3. Open `brave://extensions` and enable **Developer mode**.
4. Select **Load unpacked**, then select the extracted folder containing `manifest.json`.
5. Refresh SoundCloud and pin the extension if you want easy access to its controls.

If no release has been published yet, download the repository via **Code → Download ZIP**, extract it, and load the folder containing `manifest.json` instead. No build step is required.

This is an unpacked desktop extension, not a Web Store listing or an automatically updating installation. Managed browsers may restrict Developer mode. Chrome/Edge use `chrome://extensions` / `edge://extensions`; they are compatibility targets, not independently verified here. Firefox, Safari and mobile browsers are not supported.

## Update an existing installation

Keep the same installed folder. Replace its runtime files with the newer release, click **Reload** on its extension card, then refresh SoundCloud. Confirm **v1.2.0** in the popup. Do not install a second copy.

## How it works

- Blocks the known first-party `api-v2.soundcloud.com/audio-ads` endpoint only for SoundCloud initiators.
- Uses SoundCloud's explicit `.playbackSoundBadge.is-adPlaying` state to mute ads that still play, including audio not attached to the page DOM.
- Clicks SoundCloud's skip control only when that control allows skipping.
- Restores audio at ad end only if Guard owns the mute. Your existing mute settings and manual overrides are respected.

The fallback does not classify songs by title words, short durations, or filename guesses. The network rule targets audio-ad requests; it is not a banner blocker, general-purpose ad blocker, or a premium-content unlocker. It does not independently distinguish a pre-roll from a mid-roll if SoundCloud uses the same ad endpoint/state.

## Controls

**Block audio-ad requests** and **Mute ads & skip when available** are independent switches, both on by default. **Pause guard & restore audio** switches both off and releases Guard-owned mutes. Switch them back on to resume.

The popup updates while open. Under **Troubleshooting & privacy**, the rule test checks an ad request, ordinary track request and unrelated website. It tests rule matching, not actual ad-free playback.

Diagnostic event recording is **off by default**. Enable it before reproducing a miss, mark the missed ad, then save a report after music resumes. Turning recording off clears event history. Reports are never uploaded automatically and may still contain song titles/media paths. See [privacy and permissions](PRIVACY.md).

## Troubleshooting

- **No connection:** reload the extension, then refresh the SoundCloud tab. Check that site access is allowed.
- **Playback stalls:** turn request blocking off and leave the mute/skip fallback on.
- **An ad gets through:** check whether the popup reports an ad. Enable diagnostics and submit a reviewed report using the bug template.
- **Audio stays muted:** click Pause first. If the extension has already been disabled/removed, use the browser's tab/site sound control to unmute.
- **Before disabling/removing:** pause Guard while it is still enabled, especially during an ad. Disabled extensions cannot run cleanup.
- **Another blocker is installed:** overlapping blockers may affect results; include that detail in a bug report.

SoundCloud can change its delivery and player UI. This project cannot guarantee every ad is blocked or skipped. Browser background throttling can delay detection or recovery. A missing-heartbeat watchdog attempts to release stale Guard-owned mutes.

## Development and verification

From a standalone source checkout with Node.js 22 or later:

```sh
npm test
npm run build
```

No npm install is needed. The builder creates runtime and source ZIPs plus SHA-256 checksums in `dist/`, using an explicit allowlist that excludes browser-generated metadata, diagnostics, workspace history and credentials.

Version 1.1.0 was reported to work well by its original user on 2026-09-29. Version 1.2.0 preserves its ad rule/detector and adds release hardening. Automated tests simulate browser APIs; they do not establish compatibility across accounts, regions or browsers.

See [release checklist](RELEASE.md), [contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md), and [dated source research](RESEARCH.md).

## License and affiliation

[MIT](LICENSE). Independent community project, not affiliated with or endorsed by SoundCloud or Brave. SoundCloud and Brave names belong to their respective owners.
