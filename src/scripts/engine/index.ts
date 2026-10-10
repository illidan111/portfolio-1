import { settings } from './settings';

export interface EngineModule {
  init?(engine: Engine): void;
  update(dt: number): void;
  render(): void;
  destroy(): void;
}

// The only animation scheduler: both the woodland and visible voxel models join it.
const active = new Set<Engine>();
let frameHandle = 0;
let previous = 0;
function schedule(): void {
  if (active.size && !frameHandle) frameHandle = requestAnimationFrame(frame);
}
function frame(now: number): void {
  frameHandle = 0;
  const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 1 / 60;
  previous = now;
  for (const engine of active) engine.frame(dt);
  if (active.size) schedule();
  else previous = 0;
}

export class Engine {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  readonly modules: EngineModule[];
  reduced = settings.isReduced();
  quality = settings.quality();
  running = false;
  private visible = false;
  private observer: IntersectionObserver;
  private unsubscribe: () => void;
  private accumulator = 0;
  private samples = 0;
  private elapsed = 0;
  private maxWork = 0;
  constructor(readonly element: HTMLElement, modules: EngineModule[]) {
    this.modules = modules;
    modules.forEach(module => module.init?.(this));
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      this.sync();
    }, { threshold: 0.01 });
    this.observer.observe(element);
    this.unsubscribe = settings.subscribe(() => {
      this.reduced = settings.isReduced();
      this.quality = settings.quality();
      this.sync();
      this.invalidate();
    });
    document.addEventListener('visibilitychange', () => this.sync(), { signal: this.signal });
    this.invalidate();
  }
  private sync(): void {
    this.running = this.visible && !document.hidden && !this.reduced && !this.signal.aborted;
    this.element.dataset.engineRunning = String(this.running);
    this.element.dataset.engineReduced = String(this.reduced);
    this.element.dataset.engineQuality = this.quality;
    if (this.running) { active.add(this); schedule(); }
    else {
      active.delete(this);
      this.accumulator = 0;
      if (!active.size) { cancelAnimationFrame(frameHandle); frameHandle = 0; previous = 0; }
    }
  }
  frame(dt: number): void {
    const started = performance.now();
    this.elapsed += dt;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps < 5) {
      this.modules.forEach(module => module.update(1 / 60));
      this.accumulator -= 1 / 60;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    if (!steps) return;
    this.modules.forEach(module => module.render());
    this.samples++;
    this.maxWork = Math.max(this.maxWork, performance.now() - started);
    if (this.samples % 60 === 0) {
      this.element.dataset.engineFps = (this.samples / this.elapsed).toFixed(1);
      this.element.dataset.engineMaxWork = this.maxWork.toFixed(2);
    }
    if (this.samples === 150 && this.elapsed / this.samples > 0.028) settings.downgrade();
  }
  invalidate(): void { this.modules.forEach(module => module.render()); }
  destroy(): void {
    this.controller.abort();
    this.observer.disconnect();
    this.unsubscribe();
    active.delete(this);
    this.running = false;
    this.element.dataset.engineRunning = 'false';
    this.modules.forEach(module => module.destroy());
    if (!active.size) { cancelAnimationFrame(frameHandle); frameHandle = 0; previous = 0; }
  }
}

export function createEngine(element: HTMLElement, modules: EngineModule[]): Engine {
  return new Engine(element, modules);
}
