import { createEngine, type Engine, type EngineModule } from './index';
import { settings } from './settings';
import { features } from '../../site.config';

interface VoxelModel { palette: string[]; layers: string[][]; }
type Three = typeof import('./three-runtime');

/** A project-only enhancement. Neither this module nor three is needed by home. */
export async function mountVoxel(element: HTMLElement): Promise<() => void> {
  if (!features.voxels) return () => {};
  const fallback = element.querySelector<HTMLElement>('[data-voxel-fallback]');
  if (!fallback || !element.dataset.voxel) return () => {};
  let model: VoxelModel;
  try { model = JSON.parse(element.dataset.voxel) as VoxelModel; }
  catch { return () => {}; }

  let visible = false;
  let disposed = false;
  let failed = false;
  let loading = false;
  let generation = 0;
  let engine: Engine | undefined;
  let releasePending: (() => void) | undefined;

  const allowed = () => !disposed && !failed && !settings.isReduced() && settings.quality() !== 'low';
  const reset = () => {
    generation++;
    loading = false;
    const current = engine;
    engine = undefined;
    current?.destroy();
    releasePending?.();
    releasePending = undefined;
    fallback.hidden = false;
    element.dataset.voxelState = 'static';
  };

  const start = async () => {
    if (!visible || !allowed() || loading || engine) return;
    loading = true;
    const version = ++generation;
    // Probe before downloading three, so unsupported devices pay no library cost.
    const canvas = document.createElement('canvas');
    canvas.dataset.voxelCanvas = '';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    let context: WebGL2RenderingContext | null = null;
    try { context = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' }); }
    catch { /* A denied graphics context retains the original SVG. */ }
    if (!context) { failed = true; reset(); return; }
    let contextReleased = false;
    const releaseContext = () => {
      if (contextReleased) return;
      contextReleased = true;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    };
    releasePending = releaseContext;
    let module: EngineModule | undefined;
    try {
      const THREE = await import('./three-runtime');
      if (version !== generation || !visible || !allowed() || !element.isConnected) {
        releaseContext();
        if (version === generation) { loading = false; releasePending = undefined; }
        return;
      }
      module = makeVoxelModule(THREE, model, element, canvas, context, () => {
        failed = true;
        reset();
      });
      releasePending = undefined;
      element.querySelector('[data-voxel-canvas]')?.replaceWith(canvas);
      engine = createEngine(element, [module]);
      module.render();
      fallback.hidden = true;
      canvas.hidden = false;
      element.dataset.voxelState = 'active';
      loading = false;
    } catch {
      module?.destroy();
      releaseContext();
      if (version === generation) { failed = true; reset(); }
    }
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) void start();
    // A loaded model is paused by the common engine. Cancel only a pending load.
    else if (loading) reset();
  }, { threshold: 0.05 });
  observer.observe(element);
  const unsubscribe = settings.subscribe(() => {
    if (!allowed()) reset();
    else void start();
  });
  return () => {
    disposed = true;
    observer.disconnect();
    unsubscribe();
    reset();
  };
}

function makeVoxelModule(THREE: Three, model: VoxelModel, element: HTMLElement, canvas: HTMLCanvasElement, context: WebGL2RenderingContext, onContextLost: () => void): EngineModule {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  const height = model.layers[0].length;
  const width = model.layers[0][0].length;
  const depth = model.layers.length;
  const span = Math.max(width, height, depth) * 0.72;
  const camera = new THREE.OrthographicCamera(-span, span, span, -span, 0.1, 100);
  camera.position.set(0, 1.5, 28);
  camera.lookAt(0, 0, 0);
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const light = new THREE.DirectionalLight(0xffe8c2, 2.2);
  light.position.set(-4, 7, 8);
  scene.add(light);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = model.palette.map(color => new THREE.MeshLambertMaterial({ color, flatShading: true }));
  const meshes: InstanceType<Three['InstancedMesh']>[] = [];
  const cells: Array<Array<[number, number, number]>> = model.palette.map(() => []);
  for (const [z, layer] of model.layers.entries()) {
    for (const [y, row] of layer.entries()) {
      for (const [x, color] of [...row].entries()) {
        if (color !== '.') cells[Number(color)].push([x - (width - 1) / 2, (height - 1) / 2 - y, (depth - 1) / 2 - z]);
      }
    }
  }
  const transform = new THREE.Object3D();
  for (const [color, positions] of cells.entries()) {
    if (!positions.length) continue;
    const mesh = new THREE.InstancedMesh(geometry, materials[color], positions.length);
    for (const [index, position] of positions.entries()) {
      transform.position.set(...position);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    group.add(mesh);
  }
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const resize = () => renderer.setSize(Math.max(1, Math.round(element.clientWidth / 4)), Math.max(1, Math.round(element.clientHeight / 4)), false);
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(element);
  const controller = new AbortController();
  let pointerX = 0;
  let pointerY = 0;
  let hovered = false;
  let destroyed = false;
  element.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = element.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
    pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
    hovered = true;
  }, { signal: controller.signal });
  element.addEventListener('pointerleave', () => { hovered = false; }, { signal: controller.signal });
  canvas.addEventListener('webglcontextlost', onContextLost, { signal: controller.signal });
  group.rotation.x = -0.12;
  group.rotation.y = 0.4;
  return {
    update(dt) {
      const targetX = hovered ? pointerY * 0.7 : -0.12;
      const ease = Math.min(1, dt * 5);
      if (hovered) {
        const delta = Math.atan2(Math.sin(pointerX * 1.6 - group.rotation.y), Math.cos(pointerX * 1.6 - group.rotation.y));
        group.rotation.y += delta * ease;
      } else group.rotation.y += dt * 0.22;
      group.rotation.x += (targetX - group.rotation.x) * ease;
    },
    render() { if (!destroyed) renderer.render(scene, camera); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      resizeObserver.disconnect();
      meshes.forEach(mesh => mesh.dispose());
      geometry.dispose();
      materials.forEach(material => material.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.hidden = true;
    },
  };
}
