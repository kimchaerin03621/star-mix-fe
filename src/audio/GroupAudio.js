import { isStillMode } from '../stillMode';
const DRIFT_TOLERANCE_SECONDS = 0.04;
const DRIFT_CHECK_MS = 1500;

// Plays several stems as one logical track. It exposes the small slice of the
// HTMLAudioElement API that the app uses (play/pause/volume/playbackRate), and
// keeps the stems aligned to the first one. Each entry in `elements` can be fed
// to its own MediaElementSource, so they all merge into the same gain nodes.
export class GroupAudio {
  constructor(urls) {
    this.elements = urls.map((url) => {
      const audio = new Audio(url);
      audio.loop = true;
      audio.preload = 'auto';
      return audio;
    });
    this._lead = this.elements[0];
    this._syncTimer = null;
  }

  get paused() {
    return this._lead.paused;
  }

  get volume() {
    return this._lead.volume;
  }

  set volume(value) {
    this.elements.forEach((audio) => { audio.volume = value; });
  }

  get playbackRate() {
    return this._lead.playbackRate;
  }

  set playbackRate(value) {
    this.elements.forEach((audio) => {
      if (audio.playbackRate !== value) audio.playbackRate = value;
    });
  }

  get currentTime() {
    return this._lead.currentTime;
  }

  set currentTime(value) {
    this.elements.forEach((audio) => { audio.currentTime = value; });
  }

  play() {
    if (isStillMode) return Promise.resolve(); // still mode: no music
    this._alignFollowers();
    this._startSync();
    return Promise.all(this.elements.map((audio) => audio.play()));
  }

  pause() {
    this._stopSync();
    this.elements.forEach((audio) => audio.pause());
  }

  _alignFollowers() {
    const target = this._lead.currentTime;
    this.elements.forEach((audio) => {
      if (audio !== this._lead && Math.abs(audio.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
        audio.currentTime = target;
      }
    });
  }

  _startSync() {
    if (this._syncTimer) return;
    this._syncTimer = setInterval(() => {
      if (!this._lead.paused) this._alignFollowers();
    }, DRIFT_CHECK_MS);
  }

  _stopSync() {
    if (!this._syncTimer) return;
    clearInterval(this._syncTimer);
    this._syncTimer = null;
  }
}
