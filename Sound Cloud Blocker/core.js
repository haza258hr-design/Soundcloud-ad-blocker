(() => {
  'use strict';
  function soundcloud(value) {
    try { const u = new URL(value); return u.protocol === 'https:' &&
      (u.hostname === 'soundcloud.com' || u.hostname.endsWith('.soundcloud.com')); } catch { return false; }
  }
  function safeURL(value) {
    try {
      const u = new URL(value);
      if (u.protocol === 'blob:') return 'blob:[opaque media source]';
      if (!['https:', 'http:'].includes(u.protocol)) return '[non-HTTP source]';
      return (u.origin + u.pathname.replace(/\/s-[A-Za-z0-9]+/g, '/[private]')).slice(0, 700);
    } catch { return ''; }
  }
  function playbackRequest(value, type) {
    try { const u = new URL(value); return type === 'media' ||
      /\/(audio-ads|tracks|media)(\/|$)/.test(u.pathname) ||
      (u.hostname.endsWith('.sndcdn.com') && /\.(m3u8|mp3|aac|m4a|ts)(\/|$)/i.test(u.pathname));
    } catch { return false; }
  }
  function canSkip(button) {
    return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' &&
      !button.classList.contains('m-disabled') && button.getClientRects().length > 0;
  }
  function snapshot(doc) {
    const badge = doc.querySelector('.playbackSoundBadge');
    const ad = !!badge?.classList.contains('is-adPlaying');
    return { ad, hasBadge: !!badge, signal: ad ? 'SoundCloud is-adPlaying state' : 'no active ad state',
      title: (badge?.querySelector('.playbackSoundBadge__titleLink, .playbackTitle__title, .playbackSoundBadge__title')?.textContent || '').trim().slice(0, 160),
      media: [...doc.querySelectorAll('audio, video')].slice(0, 6).map(m => ({
        src: safeURL(m.currentSrc || m.src), playing: !m.paused && !m.ended,
        duration: Number.isFinite(m.duration) ? Math.round(m.duration * 100) / 100 : null })) };
  }
  function sanitizeSnapshot(s = {}) {
    return { ad: s.ad === true, hasBadge: s.hasBadge === true,
      signal: s.ad === true ? 'SoundCloud is-adPlaying state' : 'no active ad state',
      title: typeof s.title === 'string' ? s.title.slice(0,160) : '',
      media: Array.isArray(s.media) ? s.media.slice(0,6).map(m => ({
        src: safeURL(m.src), playing: m.playing === true,
        duration: Number.isFinite(m.duration) ? m.duration : null })) : [] };
  }
  globalThis.SCGuard = { soundcloud, safeURL, playbackRequest, canSkip, snapshot, sanitizeSnapshot };
})();
