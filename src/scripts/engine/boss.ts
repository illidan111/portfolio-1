import type { EngineModule } from './index';
import type { Scene } from './scene';
import { settings } from './settings';

const trophyKey = 'pixel-boss-trophy';
const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** A small, original clockwork visitor. Simulation is owned by the world engine. */
export function bossModule(scene: Scene): EngineModule {
  const root = scene.element.querySelector<HTMLElement>('[data-boss]');
  const hit = root?.querySelector<HTMLButtonElement>('[data-boss-hit]');
  const sprite = root?.querySelector<SVGElement>('[data-boss-sprite]');
  const hp = root?.querySelector<HTMLElement>('[data-boss-hp]');
  const bar = root?.querySelector<HTMLElement>('[role="progressbar"]');
  const message = scene.element.querySelector<HTMLElement>('[data-boss-message]');
  const status = scene.element.querySelector<HTMLElement>('[data-boss-status]');
  const shelf = document.querySelector<HTMLElement>('[data-boss-shelf]');
  let health = 5, age = 0, wait = 8, cooldown = 0, flash = 0, sequence = 0;
  let active = false, dismissed = false, reduced = settings.isReduced(), night = false, enabled = true, earned = false;
  let unsubscribe = () => {};
  let theme: MutationObserver | undefined;
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  let rainbowTimer: ReturnType<typeof setTimeout> | undefined;
  try { earned = localStorage.getItem(trophyKey) === 'earned'; } catch { /* The reward also works without storage. */ }
  try { dismissed = sessionStorage.getItem('pixel-boss-dismissed') === 'true'; } catch { /* Dismissal still works for this page. */ }

  function updateShelf(): void {
    if (!shelf) return;
    shelf.dataset.earned = String(earned);
    const copy = shelf.querySelector<HTMLElement>('[data-trophy-copy]');
    const state = shelf.querySelector<HTMLElement>('[data-trophy-state]');
    if (copy) copy.textContent = earned ? 'Mote’s golden lens. Awarded for helping a chronic overthinker close a few tabs.' : 'A curious sky visitor carries this keepsake. Look up after dark.';
    if (state) state.textContent = earned ? 'Achievement earned' : 'Undiscovered';
  }
  function say(text: string): void {
    clearTimeout(messageTimer);
    if (status) status.textContent = text;
    if (message) message.hidden = false;
    messageTimer = setTimeout(() => { if (message && !message.contains(document.activeElement)) message.hidden = true; }, 8_000);
  }
  function rainbow(value: boolean): void {
    scene.rainbow = value;
    scene.element.dataset.rainbow = String(value);
    document.dispatchEvent(new Event('pixel:rainbow'));
  }
  function show(): void {
    active = true; health = reduced ? 1 : 5; cooldown = flash = age = 0;
    if (bar) bar.setAttribute('aria-valuemax', String(health));
  }
  function render(): void {
    if (!root) return;
    root.hidden = !active;
    scene.element.dataset.bossVisible = String(active);
    if (!active) return;
    if (sprite) sprite.style.transform = reduced ? '' : `translate(${Math.round(Math.sin(age * .45) * 3) * 4}px,${Math.round(Math.cos(age * .6) * 2) * 4}px)`;
    if (hit) { hit.dataset.hit = String(!reduced && flash > 0); hit.setAttribute('aria-label', `Challenge Mote the Overthinker, ${health} ${health === 1 ? 'hit' : 'hits'} remaining`); }
    if (hp) hp.style.width = `${health / (reduced ? 1 : 5) * 100}%`;
    bar?.setAttribute('aria-valuenow', String(health));
  }
  function sync(): void {
    const previousReduced = reduced;
    reduced = settings.isReduced(); enabled = settings.get().boss;
    if (reduced) cooldown = flash = 0;
    night = document.documentElement.dataset.theme === 'night';
    if (!enabled || !night || dismissed) active = false;
    else if (reduced && !active) show();
    else if (active && previousReduced !== reduced) { health = reduced ? 1 : 5; bar?.setAttribute('aria-valuemax', String(health)); }
    render();
  }
  function challenge(): void {
    if (!active || cooldown > 0) return;
    cooldown = .5; flash = .12; health--;
    document.dispatchEvent(new CustomEvent('pixel:sound', { detail: health ? 'boss-hit' : 'boss-defeated' }));
    if (!health) {
      const bounds = hit?.getBoundingClientRect();
      const world = scene.element.getBoundingClientRect();
      if (bounds && !reduced) document.dispatchEvent(new CustomEvent('pixel:burst', { detail: { x: scene.toWorld(bounds.x + bounds.width / 2 - world.x), y: (bounds.y + bounds.height / 2 - world.y) / scene.scale, color: '#f1cf72', count: 24, kind: 'coin' } }));
      active = false; wait = 45;
      const first = !earned; earned = true; updateShelf();
      try { localStorage.setItem(trophyKey, 'earned'); } catch { /* Keep this visit's reward. */ }
      say(first ? 'Achievement earned: An eye for detail! Mote left a golden lens on your Journey trophy shelf. Fewer tabs, clearer thoughts.' : 'Mote says: “That’s five fewer tabs to think about.” Your golden lens is safe on the trophy shelf.');
      if (reduced) dismissed = true;
      if (document.activeElement === hit) scene.element.querySelector<HTMLButtonElement>('[data-boss-message-close]')?.focus({ preventScroll: true });
    }
    render();
  }
  return {
    init(engine) {
      const options = { signal: engine.signal };
      hit?.addEventListener('click', challenge, options);
      root?.querySelector('[data-boss-dismiss]')?.addEventListener('click', () => { dismissed = true; active = false; try { sessionStorage.setItem('pixel-boss-dismissed', 'true'); } catch { /* Optional visit storage. */ } render(); say('Mote wandered off to count the stars. Peaceful skies for the rest of this visit.'); scene.element.querySelector<HTMLButtonElement>('[data-boss-message-close]')?.focus({ preventScroll: true }); }, options);
      scene.element.querySelector('[data-boss-message-close]')?.addEventListener('click', () => { if (message) message.hidden = true; document.querySelector<HTMLElement>('#day-toggle')?.focus({ preventScroll: true }); }, options);
      document.addEventListener('keydown', event => {
        if (event.repeat || event.isComposing || document.querySelector('dialog[open]') || (event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)))) return;
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        sequence = key === code[sequence] ? sequence + 1 : key === code[0] ? 1 : 0;
        if (sequence !== code.length) return;
        sequence = 0; rainbow(true); clearTimeout(rainbowTimer);
        say('Prismatic curiosity · A secret rarity! The woodland torches borrowed a little color from your imagination.');
        rainbowTimer = setTimeout(() => rainbow(false), 12_000);
      }, options);
      theme = new MutationObserver(sync);
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      updateShelf(); unsubscribe = settings.subscribe(sync);
    },
    update(dt) {
      if (!night || !enabled || dismissed) return;
      if (!active) { wait -= dt; if (wait <= 0) show(); }
      else { age += dt; cooldown = Math.max(0, cooldown - dt); flash = Math.max(0, flash - dt); }
    },
    render,
    destroy() { unsubscribe(); theme?.disconnect(); clearTimeout(messageTimer); clearTimeout(rainbowTimer); scene.rainbow = false; },
  };
}
