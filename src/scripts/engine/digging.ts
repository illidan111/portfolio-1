import { profile } from '../../site.config';
import type { Engine, EngineModule } from './index';
import type { Scene } from './scene';
import { settings } from './settings';

type Secret = 'cv' | 'github' | 'fact' | 'golden';
interface Block { button: HTMLButtonElement; index: number; crack: number; broken: boolean; regrowAt: number; secret?: Secret; }
interface Flight { element: HTMLElement; elapsed: number; startX: number; startY: number; endX: number; endY: number; }
const secretNames: Record<Secret, string> = { cv: 'A well-travelled chest', github: 'A trail of commits', fact: 'A note between the stones', golden: 'The golden block!' };
const secretCopy: Record<Secret, string> = {
  cv: 'A small profile from this illustrative portfolio. Demo content, ready to read and download.',
  github: 'Follow the trail beyond this woodland and explore the developer’s GitHub profile.',
  fact: 'Every tree, tile, and creature here is original artwork built from code. No borrowed game sprites.',
  golden: 'A rare find! No special stats. Just a very good excuse for a little celebration.',
};

function readCount(): number {
  try { const count = Number(sessionStorage.getItem('pixel-loot')); return Number.isFinite(count) ? Math.min(9999, Math.max(0, Math.floor(count))) : 0; }
  catch { return 0; }
}

export function refreshLootCount(count = readCount()): void {
  const safeCount = Number.isFinite(count) ? Math.min(9999, Math.max(0, Math.floor(count))) : 0;
  document.querySelectorAll<HTMLElement>('[data-loot-count]').forEach(element => {
    element.textContent = String(safeCount);
    element.setAttribute('aria-label', `Collected blocks: ${safeCount}`);
    const label = element.parentElement?.querySelector<HTMLElement>('[data-loot-label]');
    if (label) label.textContent = safeCount === 1 ? 'block' : 'blocks';
  });
}

function seededSlots(size: number): Map<number, Secret> {
  let seed = 0;
  try { seed = Number(sessionStorage.getItem('pixel-dig-seed')); } catch { /* Use an in-memory seed when storage is blocked. */ }
  if (!Number.isInteger(seed) || seed <= 0 || seed > 0xffffffff) {
    seed = crypto.getRandomValues(new Uint32Array(1))[0]! || 1;
    try { sessionStorage.setItem('pixel-dig-seed', String(seed)); } catch { /* Discoveries remain available through ordinary links. */ }
  }
  const slots = Array.from({ length: size }, (_, index) => index);
  for (let index = slots.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = seed % (index + 1);
    [slots[index], slots[other]] = [slots[other]!, slots[index]!];
  }
  const result = new Map<number, Secret>();
  (['cv', 'github', 'fact', 'golden'] as const).forEach((secret, index) => {
    if (slots[index] !== undefined) result.set(slots[index]!, secret);
  });
  return result;
}

export function diggingModule(scene: Scene, root: HTMLElement = scene.element): EngineModule {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-dig-block]')];
  const secrets = seededSlots(buttons.length);
  const blocks: Block[] = buttons.map((button, index) => ({ button, index, crack: 0, broken: false, regrowAt: 0, secret: secrets.get(index) }));
  const flights: Flight[] = [];
  const panel = root.querySelector<HTMLElement>('[data-secret-panel]');
  const status = root.querySelector<HTMLElement>('[data-loot-status]');
  let engine: Engine;
  let count = readCount();
  let lastAnnouncement = -Infinity;
  let announcementTimer: ReturnType<typeof setTimeout> | undefined;
  let regrowTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe = () => {};
  let activeBlock: HTMLButtonElement | undefined;
  let visible = true;
  let visibilityObserver: IntersectionObserver | undefined;

  function sound(name: string): void { document.dispatchEvent(new CustomEvent('pixel:sound', { detail: name })); }
  function announce(message: string): void {
    clearTimeout(announcementTimer);
    const delay = Math.max(0, 1000 - (performance.now() - lastAnnouncement));
    announcementTimer = setTimeout(() => {
      if (status) status.textContent = message;
      lastAnnouncement = performance.now();
    }, delay);
  }
  function confetti(x: number, y: number): void {
    if (!visible || settings.isReduced()) return;
    for (const color of ['#ffdf82', '#96ff96', '#96c8ff', '#ff96ff']) {
      document.dispatchEvent(new CustomEvent('pixel:burst', { detail: { x, y, color, count: 8 } }));
    }
  }
  function reveal(secret: Secret, block: Block, x: number, y: number): void {
    if (!panel) return;
    const title = panel.querySelector<HTMLElement>('[data-secret-title]');
    const body = panel.querySelector<HTMLElement>('[data-secret-body]');
    const link = panel.querySelector<HTMLAnchorElement>('[data-secret-link]');
    if (title) title.textContent = secretNames[secret];
    if (body) body.textContent = secretCopy[secret];
    if (link) {
      link.hidden = secret !== 'cv' && secret !== 'github';
      link.removeAttribute('download'); link.removeAttribute('target'); link.removeAttribute('rel'); link.removeAttribute('href');
      if (secret === 'cv') { link.href = profile.cv; link.download = ''; link.textContent = 'Download the illustrative profile / CV'; }
      if (secret === 'github') { link.href = profile.github; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Explore GitHub ↗'; }
    }
    activeBlock = block.button;
    panel.hidden = false;
    panel.dataset.secret = secret;
    if (secret === 'golden') confetti(x, y);
  }
  function fly(rect: DOMRect): void {
    if (!visible || settings.isReduced() || flights.length >= 12) return;
    const target = document.querySelector<HTMLElement>('[data-loot-count]')?.getBoundingClientRect();
    if (!target) return;
    const element = document.createElement('span');
    element.setAttribute('aria-hidden', 'true');
    element.dataset.lootFlight = '';
    element.style.cssText = 'position:fixed;left:0;top:0;width:12px;height:12px;z-index:35;pointer-events:none;background:#d6b06a;border:4px solid #80512a;';
    document.body.append(element);
    flights.push({ element, elapsed: 0, startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2, endX: target.left + target.width / 2, endY: target.top + target.height / 2 });
  }
  function regrow(): void {
    const now = performance.now();
    let next = Infinity;
    for (const block of blocks) {
      if (!block.broken) continue;
      if (block.regrowAt <= now) {
        block.broken = false;
        block.button.disabled = false;
        block.button.removeAttribute('data-broken');
        block.button.setAttribute('aria-label', `Dig block ${block.index + 1}`);
      } else next = Math.min(next, block.regrowAt);
    }
    clearTimeout(regrowTimer);
    // A functional timer restores buttons even when motion or the offscreen engine is paused.
    if (Number.isFinite(next)) regrowTimer = setTimeout(regrow, Math.max(0, next - now));
  }
  function finish(block: Block): void {
    block.crack = 0; block.broken = true; block.regrowAt = performance.now() + 6000;
    block.button.removeAttribute('data-crack');
    block.button.dataset.broken = 'true';
    block.button.setAttribute('aria-label', `Block ${block.index + 1} is regrowing`);
    count = Math.min(9999, count + 1);
    try { sessionStorage.setItem('pixel-loot', String(count)); } catch { /* The counter still works during this visit. */ }
    refreshLootCount(count);
    const rect = block.button.getBoundingClientRect();
    const bounds = scene.element.getBoundingClientRect();
    const x = scene.toWorld(Math.max(8, Math.min(scene.width - 8, rect.left - bounds.left + rect.width / 2)));
    // The excavation band sits below the scene; its shared-canvas burst meets the woodland edge.
    const y = Math.min(scene.ground - 4, (rect.top - bounds.top + rect.height / 2) / scene.scale);
    if (visible && !settings.isReduced()) document.dispatchEvent(new CustomEvent('pixel:burst', { detail: { x, y, color: block.index % 3 === 0 ? '#a4a9ae' : '#c18a4c', count: 12 } }));
    sound('block'); sound('loot');
    fly(rect);
    if (block.secret) reveal(block.secret, block, x, y);
    announce(`${count} ${count === 1 ? 'block' : 'blocks'} collected.${block.secret ? ` Discovery: ${secretNames[block.secret]}. ${secretCopy[block.secret]}` : ' This block regrows in a few seconds.'}`);
    regrow();
  }
  return {
    init(instance) {
      engine = instance;
      const options = { signal: engine.signal };
      refreshLootCount(count);
      visibilityObserver = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        if (visible) return;
        flights.forEach(flight => flight.element.remove()); flights.length = 0;
        blocks.forEach(block => { if (block.crack > 0) finish(block); });
      }, { threshold: 0.01 });
      visibilityObserver.observe(root);
      blocks.forEach(block => {
        if (block.secret) block.button.dataset.easterEgg = block.secret;
        block.button.addEventListener('click', () => {
          if (block.broken || block.crack > 0) return;
          block.button.disabled = true;
          if (settings.isReduced()) finish(block);
          else { block.crack = 0.18; block.button.dataset.crack = '1'; }
        }, options);
      });
      if (panel) panel.querySelector('[data-close-secret]')?.addEventListener('click', () => {
        panel.hidden = true;
        const next = activeBlock && !activeBlock.disabled ? activeBlock
          : blocks.find(block => !block.button.disabled)?.button ?? document.querySelector<HTMLElement>('[data-open-settings]');
        next?.focus({ preventScroll: true });
      }, options);
      document.querySelectorAll<HTMLButtonElement>('[data-golden-block]').forEach(button => {
        button.addEventListener('click', () => {
          confetti(scene.player.x + 16, scene.player.y);
          const result = document.querySelector<HTMLElement>('[data-guide-status]');
          const message = 'Golden block found! Curiosity is its own reward. Thanks for exploring.';
          if (result) result.textContent = message;
          announce(message); sound('loot');
        }, options);
      });
      unsubscribe = settings.subscribe(() => {
        if (!settings.isReduced()) return;
        blocks.forEach(block => { if (block.crack > 0) finish(block); });
        flights.forEach(flight => flight.element.remove()); flights.length = 0;
      });
    },
    update(dt) {
      for (const block of blocks) {
        if (block.crack <= 0) continue;
        block.crack -= dt;
        if (block.crack <= 0) finish(block);
        else if (block.crack < 0.09) block.button.dataset.crack = '2';
      }
      for (let index = flights.length - 1; index >= 0; index--) {
        const flight = flights[index]!;
        flight.elapsed += dt;
        if (flight.elapsed >= 0.65) { flight.element.remove(); flights.splice(index, 1); }
      }
    },
    render() {
      for (const flight of flights) {
        const progress = Math.min(1, flight.elapsed / 0.65);
        const x = flight.startX + (flight.endX - flight.startX) * progress;
        const y = flight.startY + (flight.endY - flight.startY) * progress - Math.sin(progress * Math.PI) * 96;
        flight.element.style.transform = `translate(${Math.round(x / 4) * 4}px,${Math.round(y / 4) * 4}px)`;
      }
    },
    destroy() {
      unsubscribe(); visibilityObserver?.disconnect(); clearTimeout(announcementTimer); clearTimeout(regrowTimer);
      flights.forEach(flight => flight.element.remove()); flights.length = 0;
    },
  };
}
