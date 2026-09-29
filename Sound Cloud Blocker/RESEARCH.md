# SoundCloud failure audit — 2026-09-28

## Direct observations from public application source

Source fetched over HTTPS for text inspection only; no downloaded JavaScript was executed. research.mjs reproduces selected searches against these dated asset revisions. These are public code observations, not the user's authenticated network trace.

| Asset | SHA-256 |
|---|---|
| [55-20af8baa.js](https://a-v2.sndcdn.com/assets/55-20af8baa.js) | a1fd80dca7abbf79075aa69b6abd0f4ab168afe9bfc60dcc9479d076f0877fca |
| [56-77f63647.js](https://a-v2.sndcdn.com/assets/56-77f63647.js) | 03344637921ebb0b25983387777453e1a154ec0e5a9bdf6cfc10b214dee679f9 |
| [0-af01252c.js](https://a-v2.sndcdn.com/assets/0-af01252c.js) | ffa42a3d4b700da037701eeb1f19ac2df008bac99249b9dc0fc1fa8d9bda0ab3 |

1. Asset 0, around character 830701, defines adPlaying:"is-adPlaying" for playbackSoundBadge. Around character 833030, its event handler sets that state from isAdBreakActive() on ad-sound change and ad-break end. This is the selected detector, independent of song title and DOM audio presence.
2. Asset 55, around character 680635, constructs audio-ad sounds with is_ad: true and picks url, duration, ad_urn from the response's audio object. It parses promoted.data.audio_ads via the promoted response parser. This contradicts treating server-stitched delivery as established for this implementation.
3. Asset 56 contains getAudioAdsUrl, which calls the endpoint registry for audioAds. Asset 55 maps this to service api-v2, path audio-ads; its public service configuration uses https://api-v2.soundcloud.com/.
4. Asset 56, around character 83154, attaches a rejection path to adPod.fetch(). Failed requests reject the ad pod and release resources. Blocking may therefore let playback proceed, but this effect needs a real-account playback test.
5. Asset 0 binds .playControlsPanel__skipButton to requestSkipCurrentAd. It assigns m-disabled according to isAllowedToSkipCurrentAd(). The extension respects this state.

## Confirmed defects in 1.0.4

- fetch is not a ResourceType enum member in either [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest#type-ResourceType) or [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-ResourceType). Listener registration can throw; the same value invalidates blocking rules. Syntax checking does not validate API arguments.
- Blocking failures were explicitly discarded. The observer could fail before its second listener registered.
- The 15-second window armed after a metadata change could be later than the ad request and did not target the discovered first-party endpoint.
- No detector read is-adPlaying.
- The short-stream heuristic did not compare the old and new song title despite claiming to. It emitted true for only one scan, then false for the same source on the next scan. It could misclassify short songs.
- DOM-only media lookup cannot control media objects absent from the DOM. No live evidence established which audio engine this user's session used.
- Asynchronous read-modify-write log appends could lose simultaneous events. Logs retained raw URL queries and were not limited to SoundCloud initiators.

## Changes and tests

Version 1.1.0 replaces those mechanisms in the original folder with one static endpoint rule, the exact player state, and tab mute ownership tracking. Source inspection and 11 Node tests passed. A strict API stub reproduces the old invalid-resource-type exception. Muting/restoration works with an empty media list in the simulation. No live ad or browser extension execution was observed.

The first test run had 10 passes and one failure because the historical fixture path resolved outside the development workspace; the test path was corrected, then all 11 passed. Version 1.2.0 replaces this external fixture with a portable minimal reproduction.

## Follow-up — 2026-09-29

The original user reported that 1.1.0 "actually works really well" and requested GitHub release preparation. This is positive user-reported live feedback, not an independently captured trace or multi-account compatibility study.

Version 1.2.0 retains the same endpoint rule and detector. It adds popup controls, opt-in event logging and standalone release tooling. Twenty-one local automated tests pass, including isolated source-copy builds. The first release test run exposed two test issues: cross-VM array prototype comparison and a path scanner matching its own pattern. Both checks were corrected, then the suite passed. ZIPs were also opened and every entry read through Windows .NET's ZIP reader.

The next useful test is the 1.2.0 manual browser checklist in RELEASE.md. In particular, verify blocking does not stall playback; separately disable blocking to exercise a real ad's mute/skip fallback and next-song restoration. The release preparation itself did not observe a live 1.2.0 ad.
