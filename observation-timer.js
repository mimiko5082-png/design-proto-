import { japanDay } from './reading-store.js';
const KEY = 'basho_haiku_observation_v1';
export class ObservationTimer {
  constructor(storage, now = () => Date.now()) {
    this.storage = storage; this.now = now; this.startedAt = null; this.day = '';
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved?.day === japanDay(new Date(now())) && Number.isFinite(saved.startedAt) && saved.startedAt <= now()) { this.startedAt = saved.startedAt; this.day = saved.day; }
    } catch {}
  }
  start() {
    this.startedAt = this.now(); this.day = japanDay(new Date(this.startedAt));
    try { this.storage?.setItem(KEY, JSON.stringify({ startedAt: this.startedAt, day: this.day })); } catch {}
  }
  remaining() { return this.startedAt === null ? 30 : Math.max(0, Math.ceil((30000 - (this.now() - this.startedAt)) / 1000)); }
  ready() { return this.startedAt !== null && this.remaining() === 0; }
  reset() { this.startedAt = null; this.day = ''; try { this.storage?.removeItem(KEY); } catch {} }
}
