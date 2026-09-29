// Fetch and inspect public application code; never execute downloaded code.
import { createHash } from 'node:crypto';
const assets = {
  '55-20af8baa.js': ['createSoundSubmodel=function', 'audioAds:{', 'getAudioAdsUrl', 'audio_ads:t.data.audio_ads', 'new Audio', 'createElement("audio")'],
  '56-77f63647.js': ['getAudioAdsUrl', 'isAdBreakActive:function', 'requestAdBreak:function', 'adPod.fetch', 'CHANGE_CURRENT_AD_SOUND', 'audioAd.getSound()'],
  '0-af01252c.js': ['toggleState("adPlaying"', 'className:"playbackTitle"', 'playControlsPanel__skipButton'],
  '1-047dd6c7.js': ['getAudioAdsUrl', 'api-v2.soundcloud.com'],
};
for (const [file, terms] of Object.entries(assets)) {
  const url = 'https://a-v2.sndcdn.com/assets/' + file;
  const response = await fetch(url);
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const source = await response.text();
  console.log(JSON.stringify({url, sha256:createHash('sha256').update(source).digest('hex')}));
  for (const term of terms) {
    if (process.argv[2] && !term.includes(process.argv[2])) continue;
    const position = source.indexOf(term);
    if (position >= 0) console.log(JSON.stringify({term,position,excerpt:source.slice(Math.max(0,position-200),position+1800)}));
  }
}
