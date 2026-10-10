export interface Settings {
  motion: 'auto' | 'reduced';
  quality: 'auto' | 'high' | 'low';
  sound: boolean;
  volume: number;
  weather: 'auto' | 'off' | 'clear' | 'rain' | 'snow' | 'fog' | 'blood-moon' | 'leaves';
  boss: boolean;
  controlsHint: boolean;
}

const defaults: Settings = {
  motion: 'auto', quality: 'auto', sound: false, volume: 0.08,
  weather: 'auto', boss: true, controlsHint: true,
};
const storageKey = 'pixel-settings';
const subscribers = new Set<(value: Settings) => void>();
let current = { ...defaults };
let initialized = false;
let systemReduced = false;
let automaticQuality: 'high' | 'low' = 'high';

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

function validated(value: unknown, fallback: Settings): Settings {
  const input: Record<string, unknown> = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    motion: choice(input.motion, ['auto', 'reduced'], fallback.motion),
    quality: choice(input.quality, ['auto', 'high', 'low'], fallback.quality),
    weather: choice(input.weather, ['auto', 'off', 'clear', 'rain', 'snow', 'fog', 'blood-moon', 'leaves'], fallback.weather),
    sound: typeof input.sound === 'boolean' ? input.sound : fallback.sound,
    volume: typeof input.volume === 'number' && Number.isFinite(input.volume)
      ? Math.min(0.3, Math.max(0, input.volume)) : fallback.volume,
    boss: typeof input.boss === 'boolean' ? input.boss : fallback.boss,
    controlsHint: typeof input.controlsHint === 'boolean' ? input.controlsHint : fallback.controlsHint,
  };
}

function applyPresentation(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = current.motion === 'reduced' || systemReduced ? 'reduced' : 'full';
  document.documentElement.dataset.quality = current.quality === 'auto' ? automaticQuality : current.quality;
}

function notify(): void {
  applyPresentation();
  subscribers.forEach((subscriber) => subscriber({ ...current }));
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try { current = validated(JSON.parse(window.localStorage.getItem(storageKey) ?? 'null'), defaults); } catch { /* Storage is optional. */ }
  // Touch devices keep the conservative Low preset. Only an explicit High
  // choice enables 3D; Auto never upgrades a phone during this visit.
  automaticQuality = window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced = preference.matches;
  preference.addEventListener('change', (event) => {
    systemReduced = event.matches;
    notify();
  });
  applyPresentation();
}

export const settings = {
  get(): Settings { initialize(); return { ...current }; },
  set(patch: Partial<Settings>): void {
    initialize();
    const next = validated(patch, current);
    if ((Object.keys(next) as Array<keyof Settings>).every((key) => current[key] === next[key])) return;
    current = next;
    try { window.localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Continue with in-memory settings. */ }
    notify();
  },
  subscribe(subscriber: (value: Settings) => void): () => void {
    initialize();
    subscribers.add(subscriber);
    subscriber({ ...current });
    return () => { subscribers.delete(subscriber); };
  },
  isReduced(): boolean { initialize(); return current.motion === 'reduced' || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  quality(): 'high' | 'low' {
    initialize();
    return current.quality === 'auto' ? automaticQuality : current.quality;
  },
  downgrade(): void {
    initialize();
    if (current.quality !== 'auto' || automaticQuality === 'low') return;
    automaticQuality = 'low';
    notify();
  },
};

/** Mounts only the current page's controls; the persisted store survives navigation. */
export function mountSettings(): () => void {
  initialize();
  applyPresentation();
  const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog');
  if (!dialog) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  const openers = [...document.querySelectorAll<HTMLButtonElement>('[data-open-settings]')];
  const controls = [...dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')];
  const sound = dialog.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  const volume = dialog.querySelector<HTMLOutputElement>('[data-volume-output]');
  const live = dialog.querySelector<HTMLElement>('[data-live-region]');
  let opener: HTMLElement | null = null;
  let announcementTimer: ReturnType<typeof setTimeout> | undefined;

  function updateSound(): void {
    if (!sound) return;
    const enabled = settings.get().sound;
    const audioState = document.documentElement.dataset.audioState;
    sound.setAttribute('aria-pressed', String(enabled));
    const label = sound.querySelector<HTMLElement>('[data-sound-label]');
    if (label) label.textContent = !enabled ? 'Sound: Off'
      : audioState === 'running' || audioState === 'unavailable' ? 'Sound: On' : 'Resume sound';
    const note = dialog?.querySelector<HTMLElement>('[data-sound-note]');
    if (note) note.textContent = audioState === 'unavailable'
      ? 'Audio is unavailable in this browser. The whole world still works silently.'
      : enabled && audioState !== 'running'
        ? 'Your On preference is saved. Press Resume sound to listen in this visit.'
        : 'Original 8-bit sounds, made in your browser. Sound starts only with your permission.';
  }
  window.addEventListener('pixel:audio-state', updateSound, { signal });

  const unsubscribe = settings.subscribe((value) => {
    controls.forEach((control) => {
      const key = control.dataset.setting as keyof Settings;
      control.value = String(value[key]);
    });
    updateSound();
    if (volume) volume.textContent = `${Math.round(value.volume * 100)}%`;
    const note = dialog.querySelector<HTMLElement>('[data-motion-note]');
    const qualityNote = dialog.querySelector<HTMLElement>('[data-quality-note]');
    if (qualityNote) qualityNote.textContent = settings.quality() === 'low'
      ? `${value.quality === 'auto' ? 'Auto is using Low. ' : ''}Static item art and gentler effects. Choose High for 3D items.`
      : 'All visual effects, including rotating 3D project items.';
    if (note) note.textContent = settings.isReduced()
      ? 'Static presentation is active. Navigation and portfolio content remain available.'
      : 'Auto follows your device’s motion preference.';
  });

  function announce(message: string): void {
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => { if (live) live.textContent = message; }, 200);
  }

  function open(button: HTMLElement): void {
    if (dialog!.open || document.querySelector('dialog[open]')) return;
    opener = button;
    dialog!.showModal();
    openers.forEach((element) => element.setAttribute('aria-expanded', 'true'));
  }

  openers.forEach((button) => button.addEventListener('click', () => open(button), { signal }));
  dialog.querySelector('[data-close-settings]')?.addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('close', () => {
    openers.forEach((element) => element.setAttribute('aria-expanded', 'false'));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, { signal });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }, { signal });

  controls.forEach((control) => {
    control.addEventListener(control.type === 'range' ? 'input' : 'change', () => {
      const key = control.dataset.setting as keyof Settings;
      const value = key === 'volume' ? Number(control.value)
        : key === 'boss' || key === 'controlsHint' ? control.value === 'true' : control.value;
      settings.set({ [key]: value });
      const label = control.labels?.[0]?.textContent?.trim() ?? 'Setting';
      const selected = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent : `${Math.round(Number(value) * 100)}%`;
      announce(`${label}: ${selected}. Saved.`);
    }, { signal });
  });

  sound?.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    const audioState = document.documentElement.dataset.audioState;
    const resume = settings.get().sound && audioState !== 'running' && audioState !== 'unavailable';
    const enabled = resume || !settings.get().sound;
    settings.set({ sound: enabled });
    // Only this explicit button gesture can ask the audio module to unlock sound.
    if (enabled) window.dispatchEvent(new CustomEvent('pixel:sound-gesture', { detail: event }));
    announce(resume ? 'Sound resumed.' : `Sound ${enabled ? 'on' : 'off'}. Saved.`);
  }, { signal });

  document.addEventListener('keydown', (event) => {
    if (event.key !== '6' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    if (dialog.open) { event.preventDefault(); dialog.close(); return; }
    if (document.querySelector('dialog[open]')) return;
    const button = openers[0];
    if (button) { event.preventDefault(); open(button); }
  }, { signal });

  return () => {
    if (dialog.open) dialog.close();
    controller.abort();
    unsubscribe();
    clearTimeout(announcementTimer);
  };
}
