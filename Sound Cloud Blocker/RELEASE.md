# Release checklist

## GitHub preparation

This folder is the repository root. Publish only this project, never a parent workspace or browser profile. No GitHub repository has been created by the build process.

The source archive is a portable repository snapshot including dotfiles, tests and GitHub workflow. To publish, extract **soundcloud-midroll-guard-v1.2.0-source.zip** into a clean directory separate from an existing parent Git repository. Create an empty GitHub repository named, for example, **soundcloud-midroll-guard**, then run:

```sh
git init -b main
git add .
git status --short
git commit -m "Release SoundCloud Mid-Roll Guard 1.2.0"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace the repository URL with the actual destination. Review the staged files before committing. Never run these commands in a workspace containing unrelated projects. The included CI runs tests/build on Windows and Linux with Node 22/24 and uploads artifacts; it does not publish a release or require write permissions.

## Before a public release

- [ ] Confirm manifest.json and package.json versions match.
- [ ] Run `npm test` and `npm run build` from the source checkout.
- [ ] Load the resulting runtime ZIP unpacked in a clean test browser profile.
- [ ] Confirm popup version, no extension errors, and rule self-test passes.
- [ ] Play normal tracks and verify they remain audible.
- [ ] Verify blocking does not stall playback across song transitions.
- [ ] Disable request blocking temporarily; observe a real ad and verify fallback mute, available skip, and next-song restoration.
- [ ] Check pre-existing user mute, manual unmute, pause, reload and two SoundCloud tabs.
- [ ] Confirm diagnostics are off by default, clear history works and exported reports omit URL secrets.
- [ ] Inspect archive contents; ensure no _metadata, reports, local history or secrets.
- [ ] Check CI and record browser versions and any account/region limitations.

The original user's positive feedback concerns 1.1.0. Do not mark the new 1.2.0 manual checklist complete from that feedback alone.

## Publish

Create a GitHub release tagged **v1.2.0**, copy the matching CHANGELOG section, and attach the runtime ZIP and **SHA256SUMS.txt** from the same build. Optionally attach the source ZIP. GitHub also supplies repository source archives.

Unpacked installations do not auto-update from GitHub. Explain that users keep their existing folder, replace files, reload the extension and refresh SoundCloud.

This is prepared for GitHub distribution, not certified for Chrome Web Store publication. Store submission, branding assets and store policy review are a separate workflow.

## Primary references

- [Chrome: load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [Chrome: testMatchOutcome](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#method-testMatchOutcome) (unpacked extensions)
- [GitHub: building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
