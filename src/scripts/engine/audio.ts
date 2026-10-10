import { features } from '../../site.config';
import { settings } from './settings';

interface Tone { notes: readonly number[]; step: number; wave?: OscillatorType; gain?: number; }
const tones = {
  click: { notes: [680, 510], step: 0.022 },
  hover: { notes: [900], step: 0.018, gain: 0.08 },
  jump: { notes: [220, 330, 440, 660], step: 0.035 },
  land: { notes: [140, 90], step: 0.035 },
  block: { notes: [190, 110, 150, 70], step: 0.023, wave: 'sawtooth', gain: 0.12 },
  loot: { notes: [520, 780, 1040], step: 0.06 },
  craft: { notes: [392, 523, 659, 784], step: 0.06 },
  'boss-hit': { notes: [230, 110], step: 0.045 },
  'boss-defeated': { notes: [262, 330, 392, 523, 659, 784], step: 0.08 },
  'page-dig': { notes: [240, 180, 135, 90], step: 0.045 },
} satisfies Record<string, Tone>;
export type SoundName = keyof typeof tones;
type AudioState = 'off' | 'locked' | 'running' | 'suspended' | 'unavailable';
interface Voice { oscillator: OscillatorNode; envelope: GainNode; }

let installed = false;
let context: AudioContext | undefined;
let master: GainNode | undefined;
let unlocked = false;
let unavailable = false;
let activation = 0;
const voices = new Set<Voice>();
const lastPlayed = new Map<SoundName, number>();
const maximumVoices = 8;

function state(): AudioState {
  if (unavailable) return 'unavailable';
  if (!settings.get().sound) return 'off';
  if (!unlocked || !context) return 'locked';
  return context.state === 'running' ? 'running' : 'suspended';
}

function publish(): void {
  document.documentElement.dataset.audioState = state();
  document.documentElement.dataset.audioVoices = String(voices.size);
  window.dispatchEvent(new CustomEvent('pixel:audio-state'));
}

function retire(voice: Voice, stop = false): void {
  if (!voices.delete(voice)) return;
  voice.oscillator.onended = null;
  if (stop) {
    try { voice.oscillator.stop(); } catch { /* An ended voice is already silent. */ }
  }
  voice.oscillator.disconnect();
  voice.envelope.disconnect();
  document.documentElement.dataset.audioVoices = String(voices.size);
}

function suspend(): void {
  activation++;
  for (const voice of [...voices]) retire(voice, true);
  if (context && context.state !== 'closed') void context.suspend().catch(() => {});
  publish();
}

function play(name: SoundName): void {
  if (!context || !master || !unlocked || !settings.get().sound || document.hidden || context.state !== 'running') return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < (name === 'hover' ? 100 : 40)) return;
  lastPlayed.set(name, now);
  if (voices.size >= maximumVoices) {
    const oldest = voices.values().next().value;
    if (oldest) retire(oldest, true);
  }
  const tone: Tone = tones[name];
  const start = context.currentTime;
  const end = start + tone.notes.length * tone.step;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = tone.wave ?? 'square';
  tone.notes.forEach((frequency, index) => oscillator.frequency.setValueAtTime(frequency, start + index * tone.step));
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(tone.gain ?? 0.15, start + 0.003);
  envelope.gain.setValueAtTime(tone.gain ?? 0.15, Math.max(start + 0.003, end - 0.012));
  envelope.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(envelope);
  envelope.connect(master);
  const voice = { oscillator, envelope };
  voices.add(voice);
  oscillator.onended = () => retire(voice);
  oscillator.start(start);
  oscillator.stop(end);
  document.documentElement.dataset.audioVoices = String(voices.size);
}

async function unlock(event: Event): Promise<void> {
  // Settings forwards its original trusted click, never a synthetic activation.
  const gesture = (event as CustomEvent<Event>).detail;
  if (!(gesture instanceof Event) || !gesture.isTrusted || !settings.get().sound || document.hidden) return;
  const version = ++activation;
  try {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = settings.get().volume;
      master.connect(context.destination);
      context.addEventListener('statechange', publish);
    }
    unlocked = true;
    await context.resume();
    if (version !== activation) return;
    if (!settings.get().sound || document.hidden) { suspend(); return; }
    publish();
    play('click');
  } catch {
    unavailable = typeof AudioContext === 'undefined';
    publish();
  }
}

/** One manager for the browser document, surviving Astro swaps. No animation loop. */
export function mountAudio(): void {
  if (!features.audio) return;
  if (installed) { publish(); return; }
  installed = true;
  settings.subscribe(value => {
    if (master && context) master.gain.setValueAtTime(value.volume, context.currentTime);
    if (!value.sound) suspend();
    else publish();
  });
  window.addEventListener('pixel:sound-gesture', event => { void unlock(event); });
  document.addEventListener('pixel:sound', event => {
    const name: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof name === 'string' && Object.hasOwn(tones, name)) play(name as SoundName);
  });
  document.addEventListener('click', event => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest('a, button, select, input');
    if (control && !control.matches('[data-sound-toggle], input[type="range"]')) play('click');
  });
  document.addEventListener('pointerover', event => {
    if (!event.isTrusted || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
    const control = event.target.closest('a, button, select, input');
    if (!control || (event.relatedTarget instanceof Node && control.contains(event.relatedTarget))) return;
    play('hover');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  window.addEventListener('pagehide', suspend);
  document.addEventListener('astro:page-load', publish);
  publish();
}
