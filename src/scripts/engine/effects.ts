import { features } from '../../site.config';
import type { Engine, EngineModule } from './index';
import type { Scene } from './scene';
import { settings, type Settings } from './settings';

type Weather = Exclude<Settings['weather'], 'auto'>;
type ParticleKind = 'spark' | 'rain' | 'snow' | 'fog' | 'leaf' | 'firefly';
interface Particle {
  active: boolean; kind: ParticleKind; x: number; y: number; vx: number; vy: number;
  life: number; total: number; size: number; phase: number; color: string;
}
interface Burst { x: number; y: number; color?: string; count?: number; }

const descriptions: Record<Weather, string> = {
  off: 'Weather off', clear: 'Clear skies', rain: 'A little woodland rain', snow: 'Soft snowfall',
  fog: 'Mist in the treetops', 'blood-moon': 'Blood moon · It’s just a phase.', leaves: 'Autumn leaves',
};
const leafColors = ['#dca659', '#c76d3f', '#eccb78'];

function visitChance(): number {
  try {
    const saved = sessionStorage.getItem('pixel-weather-visit');
    const value = saved === null ? NaN : Number(saved);
    if (Number.isFinite(value) && value >= 0 && value < 1) return value;
    const next = Math.random();
    sessionStorage.setItem('pixel-weather-visit', String(next));
    return next;
  } catch { return Math.random(); }
}

/** The woodland's one visible effects canvas; all simulation joins the shared engine. */
export function effectsModule(scene: Scene): EngineModule {
  const canvas = scene.element.querySelector<HTMLCanvasElement>('[data-effects]');
  const context = canvas?.getContext('2d');
  const lightmap = document.createElement('canvas');
  const lights = lightmap.getContext('2d');
  const particles: Particle[] = Array.from({ length: 150 }, () => ({
    active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0,
    life: 0, total: 0, size: 2, phase: 0, color: '#ffffff',
  }));
  const rareNight = visitChance() < 0.04;
  let engine: Engine;
  let reduced = settings.isReduced();
  let low = settings.quality() === 'low';
  let value = settings.get();
  let night = document.documentElement.dataset.theme === 'night';
  let weather: Weather = 'clear';
  let time = 0;
  let lightAge = Infinity;
  let dirty = true;
  let emitTime = 0;
  let activeCount = 0;
  let divisor = low ? 8 : 4;
  let unsubscribe = () => {};
  let observer: MutationObserver | undefined;

  function chooseWeather(): Weather {
    if (!features.weather) return 'clear';
    if (value.weather !== 'auto') return value.weather === 'blood-moon' && !night ? 'clear' : value.weather;
    if (night && rareNight) return 'blood-moon';
    const month = new Date().getMonth();
    if (month === 11 || month <= 1) return 'snow';
    if (month <= 4) return 'rain';
    if (month >= 8) return 'leaves';
    return 'clear';
  }

  function sync(): void {
    reduced = settings.isReduced();
    low = settings.quality() === 'low';
    value = settings.get();
    night = document.documentElement.dataset.theme === 'night';
    const next = chooseWeather();
    if (weather !== next || reduced || low) {
      particles.forEach(particle => { if (particle.kind !== 'spark' || reduced) particle.active = false; });
    }
    weather = next;
    const cap = reduced ? 0 : low ? 50 : 150;
    let count = 0;
    particles.forEach(particle => { if (particle.active && ++count > cap) particle.active = false; });
    scene.element.dataset.weather = weather;
    scene.element.dataset.lighting = features.lighting && night ? 'on' : 'off';
    document.querySelectorAll<HTMLElement>('[data-weather-label]').forEach(label => {
      label.textContent = descriptions[weather];
    });
    dirty = true;
    lightAge = Infinity;
    // Settings and theme can change while reduced motion has the scheduler paused.
    render();
  }

  function spawn(kind: ParticleKind, x: number, y: number): Particle | undefined {
    if (reduced) return undefined;
    const limit = low ? 50 : 150;
    let first: Particle | undefined;
    let count = 0;
    for (const particle of particles) {
      if (particle.active) count++;
      else first ??= particle;
    }
    if (count >= limit || !first) return undefined;
    first.active = true;
    first.kind = kind;
    first.x = x; first.y = y;
    first.vx = 0; first.vy = 0;
    first.life = first.total = 5;
    first.size = 2;
    first.phase = Math.random() * Math.PI * 2;
    first.color = '#dfefff';
    return first;
  }

  function burst(detail: Burst): void {
    if (!Number.isFinite(detail.x) || !Number.isFinite(detail.y)) return;
    const count = Math.min(32, Math.max(0, Math.floor(detail.count ?? 12)));
    for (let index = 0; index < count; index++) {
      const particle = spawn('spark', detail.x, detail.y);
      if (!particle) break;
      particle.vx = (Math.random() - 0.5) * 180;
      particle.vy = -40 - Math.random() * 140;
      particle.life = particle.total = 0.4 + Math.random() * 0.4;
      particle.size = 2 + Math.floor(Math.random() * 2);
      particle.color = typeof detail.color === 'string' ? detail.color : '#ffc896';
    }
  }

  function populate(): void {
    if (reduced) return;
    const fireflies = features.lighting && night && weather !== 'off' ? low ? 5 : 14 : 0;
    const kind: ParticleKind | undefined = low || !features.weather ? undefined
      : weather === 'rain' || weather === 'snow' || weather === 'fog' ? weather
      : weather === 'leaves' ? 'leaf' : undefined;
    const target = kind === 'rain' ? 96 : kind === 'snow' ? 64 : kind === 'fog' ? 12 : kind === 'leaf' ? 32 : 0;
    let fireflyCount = 0;
    let weatherCount = 0;
    particles.forEach(particle => {
      if (!particle.active) return;
      if (particle.kind === 'firefly') fireflyCount++;
      else if (particle.kind === kind) weatherCount++;
    });
    if (fireflyCount < fireflies) {
      const particle = spawn('firefly', scene.toWorld(Math.random() * scene.width), 320 + Math.random() * 140);
      if (particle) {
        particle.color = '#e6e998'; particle.life = particle.total = 8 + Math.random() * 5;
        particle.vx = (Math.random() - 0.5) * 12; particle.vy = (Math.random() - 0.5) * 5;
      }
    }
    if (kind && weatherCount < target) {
      // Populate gradually, including partway down the scene, to avoid an empty first minute.
      const particle = spawn(kind, scene.toWorld(Math.random() * scene.width), Math.random() * 490);
      if (!particle) return;
      particle.life = particle.total = kind === 'rain' ? 3 : kind === 'fog' ? 12 : 10;
      particle.vx = kind === 'rain' ? -32 : 8 + Math.random() * 10;
      particle.vy = kind === 'rain' ? 320 : kind === 'fog' ? 0 : 16 + Math.random() * 18;
      particle.color = kind === 'leaf' ? leafColors[Math.floor(Math.random() * leafColors.length)]! : kind === 'rain' ? '#b7d2ef' : '#e7edf0';
      particle.size = kind === 'fog' ? 40 + Math.random() * 60 : kind === 'leaf' ? 3 : 2;
    }
  }

  function resize(): void {
    if (!canvas || !context || !lights) return;
    divisor = low ? 8 : 4;
    const width = Math.max(1, Math.ceil(scene.width / divisor));
    const height = Math.max(1, Math.ceil(scene.height / divisor));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = lightmap.width = width;
    canvas.height = lightmap.height = height;
    context.imageSmoothingEnabled = false;
    lights.imageSmoothingEnabled = false;
    dirty = true;
  }

  function octagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    const r = Math.max(1, Math.round(radius));
    const side = Math.round(r * 0.42);
    x = Math.round(x); y = Math.round(y);
    ctx.beginPath();
    ctx.moveTo(x - side, y - r); ctx.lineTo(x + side, y - r);
    ctx.lineTo(x + r, y - side); ctx.lineTo(x + r, y + side);
    ctx.lineTo(x + side, y + r); ctx.lineTo(x - side, y + r);
    ctx.lineTo(x - r, y + side); ctx.lineTo(x - r, y - side);
    ctx.closePath(); ctx.fill();
  }

  function lamp(x: number, y: number, radius: number, strength: number, seed: number): void {
    if (!lights) return;
    const flicker = reduced ? 1 : 0.98 + ((Math.floor(time * 2) + seed) % 3) * 0.02;
    const cx = scene.toScreen(x) / divisor;
    const cy = y * scene.scale / divisor;
    const r = radius * scene.scale / divisor * flicker;
    lights.globalCompositeOperation = 'destination-out';
    lights.fillStyle = '#000';
    lights.globalAlpha = strength * 0.3; octagon(lights, cx, cy, r);
    lights.globalAlpha = strength * 0.4; octagon(lights, cx, cy, r * 0.72);
    lights.globalAlpha = strength * 0.7; octagon(lights, cx, cy, r * 0.42);
    lights.globalCompositeOperation = 'source-over';
    lights.globalAlpha = strength * 0.1;
    const rainbow = ['#ffd285', '#9be2bc', '#bda8f4'];
    lights.fillStyle = scene.rainbow ? rainbow[(Math.floor(time * 0.5) + seed) % rainbow.length]! : '#ffc87f';
    octagon(lights, cx, cy, r * 0.72);
    lights.globalAlpha = 1;
  }

  function renderLights(): void {
    if (!lights) return;
    lights.clearRect(0, 0, lightmap.width, lightmap.height);
    lights.globalCompositeOperation = 'source-over';
    lights.globalAlpha = 1;
    if (weather === 'blood-moon') { lights.fillStyle = '#902d4938'; lights.fillRect(0, 0, lightmap.width, lightmap.height); }
    else if (weather === 'fog') { lights.fillStyle = '#cad9e224'; lights.fillRect(0, 0, lightmap.width, lightmap.height); }
    else if (weather === 'rain') { lights.fillStyle = '#263c5e18'; lights.fillRect(0, 0, lightmap.width, lightmap.height); }
    else if (weather === 'snow') { lights.fillStyle = '#d4e5f514'; lights.fillRect(0, 0, lightmap.width, lightmap.height); }
    else if (weather === 'leaves') { lights.fillStyle = '#ad73390a'; lights.fillRect(0, 0, lightmap.width, lightmap.height); }
    if (features.lighting && night) {
      lights.fillStyle = weather === 'blood-moon' ? '#270e33a8' : '#071125a8';
      lights.fillRect(0, 0, lightmap.width, lightmap.height);
      lamp(1024, 466, 140, 0.94, 0);
      lamp(1136, 438, 80, 0.85, 1); lamp(1244, 438, 80, 0.85, 2);
      lamp(650, 465, 100, 0.8, 3); lamp(1360, 455, 100, 0.8, 4);
      lamp(scene.player.x + 16, scene.player.y + 20, 70, 0.68, 5);
      if (scene.pointer.x > -500 && !reduced) lamp(scene.pointer.x, scene.pointer.y, 100, 0.4, 6);
    }
    lightAge = 0;
    dirty = false;
  }

  function torch(x: number, y: number): void {
    if (!context) return;
    const cx = Math.round(scene.toScreen(x) / divisor);
    const cy = Math.round(y * scene.scale / divisor);
    const unit = Math.max(1, Math.round(4 * scene.scale / divisor));
    context.fillStyle = '#513a28'; context.fillRect(cx, cy, unit, unit * 6);
    context.fillStyle = '#b28751'; context.fillRect(cx, cy, unit, unit * 3);
    context.fillStyle = '#e89650'; context.fillRect(cx - unit, cy - unit * 2, unit * 3, unit * 2);
    context.fillStyle = '#ffe69b'; context.fillRect(cx, cy - unit * 3, unit, unit * 2);
  }

  function render(): void {
    if (!canvas || !context || !lights) return;
    resize();
    if (dirty || lightAge >= 1 / 30) renderLights();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(lightmap, 0, 0);
    if (features.lighting) { torch(650, 465); torch(1360, 455); }
    activeCount = 0;
    if (!reduced) for (const particle of particles) {
      if (!particle.active) continue;
      activeCount++;
      const x = Math.round(scene.toScreen(particle.x) / divisor);
      const y = Math.round(particle.y * scene.scale / divisor);
      const size = Math.max(1, Math.round(particle.size * scene.scale / divisor));
      context.fillStyle = particle.color;
      context.globalAlpha = particle.kind === 'fog' ? 0.045 : particle.kind === 'rain' ? 0.48 : particle.kind === 'spark' ? Math.min(1, particle.life * 3) : 0.85;
      if (particle.kind === 'rain') context.fillRect(x, y, 1, Math.max(2, Math.round(12 * scene.scale / divisor)));
      else if (particle.kind === 'fog') context.fillRect(x, y, size * 4, size);
      else context.fillRect(x, y, size, size);
    }
    context.globalAlpha = 1;
    canvas.dataset.particleCount = String(activeCount);
    canvas.dataset.lightmapWidth = String(lightmap.width);
  }

  return {
    init(instance) {
      engine = instance;
      const options = { signal: engine.signal };
      const pointerSurface = scene.element.parentElement ?? scene.element;
      pointerSurface.addEventListener('pointermove', (event) => {
        const bounds = scene.element.getBoundingClientRect();
        scene.pointer.x = scene.toWorld(event.clientX - bounds.left);
        scene.pointer.y = (event.clientY - bounds.top) / scene.scale;
      }, { ...options, passive: true });
      pointerSurface.addEventListener('pointerleave', () => { scene.pointer.x = scene.pointer.y = -999; }, options);
      document.addEventListener('pixel:burst', (event) => {
        const detail: unknown = (event as CustomEvent<unknown>).detail;
        if (detail && typeof detail === 'object' && 'x' in detail && 'y' in detail) burst(detail as Burst);
      }, options);
      observer = new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      unsubscribe = settings.subscribe(sync);
    },
    update(dt) {
      if (reduced) return;
      time += dt; lightAge += dt; emitTime += dt;
      if (emitTime >= 1 / 30) { populate(); emitTime = 0; }
      const left = scene.toWorld(-40);
      const right = scene.toWorld(scene.width + 40);
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0 || particle.y > 510 || particle.x < left || particle.x > right) { particle.active = false; continue; }
        if (particle.kind === 'spark') particle.vy += 230 * dt;
        if (particle.kind === 'firefly') {
          const dx = particle.x - scene.pointer.x;
          const dy = particle.y - scene.pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 80) {
            particle.x += dx / distance * (80 - distance) * dt * 0.3;
            particle.y += dy / distance * (80 - distance) * dt * 0.3;
          }
          particle.x += Math.sin(time * 0.7 + particle.phase) * dt * 6;
          particle.y += Math.cos(time * 0.8 + particle.phase) * dt * 4;
        } else if (particle.kind === 'leaf' || particle.kind === 'snow') {
          particle.x += Math.sin(time + particle.phase) * dt * 9;
        }
        particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      }
    },
    render,
    destroy() {
      observer?.disconnect(); unsubscribe();
      particles.forEach(particle => { particle.active = false; });
      context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      lightmap.width = lightmap.height = 0;
      if (canvas) canvas.dataset.particleCount = '0';
    },
  };
}
