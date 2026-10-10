import { features } from '../../site.config';
import { createEngine } from './index';
import { Scene } from './scene';
import { heroModule } from './hero';
import { effectsModule } from './effects';
import { mountSettings } from './settings';

let dispose: (() => void) | undefined;
function mount(): void {
  dispose?.();
  const cleanups: (() => void)[] = [mountSettings()];
  const world = document.querySelector<HTMLElement>('[data-world]');
  if (world && features.hero) {
    const scene = new Scene(world);
    const engine = createEngine(world, [heroModule(scene), effectsModule(scene)]);
    const resize = new ResizeObserver(() => { scene.resize(); engine.invalidate(); });
    resize.observe(world);
    cleanups.push(() => { resize.disconnect(); engine.destroy(); });
  }
  dispose = () => cleanups.forEach(cleanup => cleanup());
}
document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', () => { dispose?.(); dispose = undefined; });
