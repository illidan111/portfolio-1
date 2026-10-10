// Narrow declarations for the APIs used by our voxel renderer. Keeping this local
// avoids an additional dependency for one small, optional enhancement.
declare module 'three' {
  export class Vector3 {
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
  }
  export class Euler { x: number; y: number; z: number; }
  export class Matrix4 { elements: number[]; }
  export class Object3D {
    position: Vector3;
    rotation: Euler;
    matrix: Matrix4;
    add(...objects: Object3D[]): this;
    clear(): this;
    updateMatrix(): void;
    lookAt(x: number, y: number, z: number): void;
  }
  export class Group extends Object3D {}
  export class Scene extends Object3D {}
  export class OrthographicCamera extends Object3D {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
  }
  export class BoxGeometry {
    constructor(width?: number, height?: number, depth?: number);
    dispose(): void;
  }
  export class MeshLambertMaterial {
    constructor(options: { color: string; flatShading: boolean });
    dispose(): void;
  }
  export class InstancedMesh extends Object3D {
    constructor(geometry: BoxGeometry, material: MeshLambertMaterial, count: number);
    instanceMatrix: { needsUpdate: boolean };
    setMatrixAt(index: number, matrix: Matrix4): void;
    computeBoundingSphere(): void;
    dispose(): void;
  }
  export class AmbientLight extends Object3D {
    constructor(color: number, intensity: number);
  }
  export class DirectionalLight extends Object3D {
    constructor(color: number, intensity: number);
  }
  export class WebGLRenderer {
    constructor(options: { canvas: HTMLCanvasElement; context: WebGL2RenderingContext; antialias: boolean; alpha: boolean; powerPreference: 'low-power' });
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setClearColor(color: number, alpha: number): void;
    render(scene: Scene, camera: OrthographicCamera): void;
    dispose(): void;
    forceContextLoss(): void;
  }
}
