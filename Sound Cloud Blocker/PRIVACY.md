# Privacy

Guard has no analytics, account system, telemetry, advertising, or backend. It does not upload diagnostic reports.

## Browser permissions

- **declarativeNetRequest**: block the single known SoundCloud audio-ad endpoint when requested by SoundCloud.
- **webRequest**: observe relevant SoundCloud playback request metadata for optional diagnostics; not response bodies.
- **storage**: keep settings and temporary player/diagnostic state.
- **alarms**: recover a mute owned by Guard if the page stops reporting.
- **soundcloud.com and its subdomains**: detect the player ad state and handle the first-party API.
- **sndcdn.com subdomains**: optional media-request diagnostics.

Guard uses the browser's tab-muting API. It does not request unrestricted browsing history, microphone, cookies, debugger, or all-sites access.

## Data and retention

Settings use browser sync storage, so the browser may synchronize the on/off preferences if its sync feature is enabled. Guard sends no data to its own service.

Current player state (including a bounded song title, up to six sanitized media URLs, duration, ad state, and mute ownership) is kept in browser session storage even with event recording off. This supports status and restoration. Tab state is removed when a tab closes, navigates, or its heartbeat expires.

Event recording is **off by default**. When enabled, up to 300 events across SoundCloud tabs retain timestamps, song titles, ad state and relevant request metadata: sanitized URL, type, content type, status/error and request ID. URL queries, fragments, credentials and recognized private-link path tokens are stripped. This is not full anonymization: media paths and titles can still identify listening activity.

Session storage normally clears on browser restart or extension reload/disable. Turning recording off clears event history. **Clear diagnostics** clears history, errors and rule-test results without erasing the current player state needed to restore audio. Old pre-1.1 unredacted request logs are removed on upgrade.

**Save report** downloads a JSON file containing the selected tab's state/events, preferences, last error and rule-test result. It stays until you delete it. Review it before sharing; do not post cookies, authorization headers or raw network captures in public issues.

No request bodies, response bodies, cookies, authorization headers or audio recordings are collected.
