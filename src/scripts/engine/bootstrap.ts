import { features } from '../../site.config';
import { createEngine, type EngineModule } from './index';
import { Scene } from './scene';
import { heroModule } from './hero';
import { effectsModule } from './effects';
import { diggingModule, refreshLootCount } from './digging';
import { mountSettings } from './settings';
import { bossModule } from './boss';
import { mountMinimap } from './minimap';
import { mountCrafting } from './crafting';
import { mountAudio } from './audio';

let dispose: (() => void) | undefined;
function mount(): void {
  dispose?.();
  const cleanups: (() => void)[] = [mountSettings()];
  if (features.audio) mountAudio();
  if (features.minimap) cleanups.push(mountMinimap());
  if (features.crafting) cleanups.push(mountCrafting());
  if (features.digging) refreshLootCount();
  let disposed = false;
  const world = document.querySelector<HTMLElement>('[data-world]');
  const needsWorld = features.hero || features.lighting || features.weather || features.digging || features.boss;
  if (world && needsWorld) {
    const scene = new Scene(world);
    const modules: EngineModule[] = [];
    if (features.hero) modules.push(heroModule(scene));
    modules.push(effectsModule(scene));
    if (features.boss) modules.push(bossModule(scene));
    const engine = createEngine(world, modules);
    const resize = new ResizeObserver(() => { scene.resize(); engine.invalidate(); });
    resize.observe(world);
    cleanups.push(() => { resize.disconnect(); engine.destroy(); });
    const strip = document.querySelector<HTMLElement>('[data-digging]');
    if (features.digging && strip) {
      const digging = createEngine(strip, [diggingModule(scene, strip)]);
      cleanups.push(() => digging.destroy());
    }
  }
  if (features.voxels) document.querySelectorAll<HTMLElement>('[data-voxel]').forEach(element => {
    void import('./voxel').then(async ({ mountVoxel }) => {
      if (disposed) return;
      const cleanup = await mountVoxel(element);
      if (disposed) cleanup();
      else cleanups.push(cleanup);
    });
  });
  dispose = () => { disposed = true; cleanups.forEach(cleanup => cleanup()); };
}
document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', () => { dispose?.(); dispose = undefined; });
// The conditional Game import can finish after the first page-load event.
mount();
