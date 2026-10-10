import type { Engine, EngineModule } from './index';
import { Scene } from './scene';
import { settings } from './settings';

export function heroModule(scene: Scene): EngineModule {
  let engine: Engine;
  let frame = 0;
  let cooldown = 0;
  let controlled = false;
  const pressed = new Set<string>();
  const playerElement = scene.element.querySelector<HTMLElement>('[data-player]')!;
  const controls = scene.element.querySelector<HTMLElement>('[data-game-controls]')!;
  const input = scene.element.querySelector<HTMLElement>('[data-game-input]')!;
  const door = scene.element.querySelector<HTMLAnchorElement>('[data-house-door]')!;
  const message = scene.element.querySelector<HTMLElement>('[data-game-message]')!;
  function sound(name: string): void { document.dispatchEvent(new CustomEvent('pixel:sound', { detail: name })); }
  function release(): void { controlled = false; pressed.clear(); input.blur(); scene.element.dataset.controlling = 'false'; }
  function hitFire(): void {
    if (cooldown > 0) return;
    cooldown = 1.2;
    message.textContent = 'Ouch! Toasty boots. No damage done.';
    document.dispatchEvent(new CustomEvent('pixel:burst', { detail: { x: scene.player.x + 16, y: scene.ground - 12, color: '#ffc896', count: 12 } }));
  }
  function jump(): void {
    if (!engine.reduced && scene.player.grounded) { scene.player.vy = -370; scene.player.grounded = false; sound('jump'); }
  }
  function updatePrompt(): void {
    const nearby = Math.abs(scene.player.x + 16 - scene.door.x) < 76;
    door.dataset.near = String(nearby);
    door.setAttribute('aria-label', 'Enter the house — go to Contact');
  }
  return {
    init(instance) {
      engine = instance;
      const options = { signal: engine.signal };
      input.addEventListener('focus', () => { controlled = true; scene.element.dataset.controlling = 'true'; }, options);
      input.addEventListener('blur', () => { controlled = false; pressed.clear(); scene.element.dataset.controlling = 'false'; }, options);
      input.addEventListener('keydown', event => {
        if (engine.reduced || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === 'escape') { release(); return; }
        if (['a', 'd', 'arrowleft', 'arrowright', ' ', 'w', 'arrowup'].includes(key)) {
          event.preventDefault(); pressed.add(key);
          if (!event.repeat && [' ', 'w', 'arrowup'].includes(key)) jump();
        }
        if (key === 'e' && Math.abs(scene.player.x + 16 - scene.door.x) < 76) { event.preventDefault(); release(); door.click(); }
      }, options);
      input.addEventListener('keyup', event => pressed.delete(event.key.toLowerCase()), options);
      window.addEventListener('blur', release, options);
      document.addEventListener('visibilitychange', () => { if (document.hidden) release(); }, options);
      scene.element.querySelector('[data-hide-controls]')?.addEventListener('click', () => settings.set({ controlsHint: false }), options);
      scene.element.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button => {
        const key = button.dataset.move!;
        button.addEventListener('pointerdown', event => {
          if (engine.reduced) return;
          event.preventDefault(); button.setPointerCapture(event.pointerId);
          controlled = true; pressed.add(key);
          if (key === 'jump') jump();
        }, options);
        const stop = () => { pressed.delete(key); if (!pressed.size) controlled = false; };
        button.addEventListener('pointerup', stop, options);
        button.addEventListener('pointercancel', stop, options);
        button.addEventListener('lostpointercapture', stop, options);
        button.addEventListener('keydown', event => {
          if (![' ', 'Enter'].includes(event.key) || engine.reduced) return;
          event.preventDefault(); controlled = true; pressed.add(key);
          if (key === 'jump' && !event.repeat) jump();
        }, options);
        button.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) stop(); }, options);
        button.addEventListener('click', event => { if (event.detail === 0 && key === 'jump') jump(); }, options);
      });
    },
    update(dt) {
      const p = scene.player;
      frame += dt;
      cooldown = Math.max(0, cooldown - dt);
      const move = controlled ? Number(pressed.has('d') || pressed.has('arrowright') || pressed.has('right')) - Number(pressed.has('a') || pressed.has('arrowleft') || pressed.has('left')) : 0;
      p.vx = move * 180;
      if (move) p.facing = move;
      const oldX = p.x;
      p.x += p.vx * dt;
      for (const solid of scene.solids) {
        if (p.x + p.w > solid.x && p.x < solid.x + solid.w && p.y + p.h > solid.y + 2 && p.y < solid.y + solid.h) {
          if (solid.kind === 'fire') hitFire();
          if (oldX + p.w <= solid.x + 1) p.x = solid.x - p.w;
          else if (oldX >= solid.x + solid.w - 1) p.x = solid.x + solid.w;
        }
      }
      p.x = Math.max(scene.toWorld(8), Math.min(scene.toWorld(scene.width - 8) - p.w, p.x));
      const oldBottom = p.y + p.h;
      p.vy += 1000 * dt;
      p.y += p.vy * dt;
      let floor = scene.ground;
      for (const solid of scene.solids) {
        if (p.x + p.w > solid.x && p.x < solid.x + solid.w && oldBottom <= solid.y + 3 && p.y + p.h >= solid.y && p.vy >= 0) {
          floor = Math.min(floor, solid.y);
          if (solid.kind === 'fire') hitFire();
        }
      }
      if (p.y + p.h >= floor) {
        if (!p.grounded && p.vy > 50) sound('land');
        p.y = floor - p.h; p.vy = 0; p.grounded = true;
      } else p.grounded = false;
    },
    render() {
      const p = scene.player;
      if (engine?.reduced) { pressed.clear(); controlled = false; p.vx = 0; p.y = scene.ground - p.h; }
      const step = !engine?.reduced && p.grounded && p.vx ? Math.floor(frame * 10) % 2 * 2 : 0;
      playerElement.style.transform = `translate(${Math.round(scene.toScreen(p.x))}px, ${Math.round((p.y - step) * scene.scale)}px) scale(${scene.scale})`;
      playerElement.dataset.x = p.x.toFixed(1); playerElement.dataset.y = p.y.toFixed(1);
      playerElement.dataset.grounded = String(p.grounded);
      playerElement.style.setProperty('--facing', String(p.facing));
      door.style.left = `${Math.round(scene.toScreen(scene.door.x))}px`;
      door.style.top = `${Math.round(scene.door.y * scene.scale)}px`;
      controls.hidden = !!engine?.reduced || !settings.get().controlsHint;
      input.hidden = !!engine?.reduced;
      scene.element.dataset.reduced = String(!!engine?.reduced);
      updatePrompt();
    },
    destroy() { pressed.clear(); }
  };
}
