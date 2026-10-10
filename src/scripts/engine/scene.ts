export interface Point { x: number; y: number; }
export interface Bounds { x: number; y: number; w: number; h: number; kind: 'house' | 'fence' | 'fire'; }
export class Scene {
  width = 1600;
  height = 600;
  scale = 1;
  offset = 0;
  ground = 492;
  player = { x: 760, y: 452, w: 32, h: 40, vx: 0, vy: 0, grounded: true, facing: 1 };
  pointer: Point = { x: -999, y: -999 };
  time = 0;
  rainbow = false;
  readonly solids: Bounds[] = [
    { x: 1084, y: 384, w: 192, h: 108, kind: 'house' },
    { x: 860, y: 458, w: 72, h: 34, kind: 'fence' },
    { x: 1012, y: 468, w: 40, h: 24, kind: 'fire' },
  ];
  constructor(readonly element: HTMLElement) { this.resize(); }
  resize(): void {
    const bounds = this.element.getBoundingClientRect();
    this.width = bounds.width;
    this.height = bounds.height;
    // The hero grows with the panorama on wide screens; mobile crops only its sides.
    // This matches the artwork without the former vertical stretch at widths above 1600px.
    this.scale = this.height / 600;
    this.offset = (this.width - 1600 * this.scale) / 2;
    this.ground = 492;
    const left = this.toWorld(0);
    const right = this.toWorld(this.width);
    this.player.x = Math.max(left + 8, Math.min(right - 40, this.player.x));
  }
  toScreen(x: number): number { return x * this.scale + this.offset; }
  toWorld(x: number): number { return (x - this.offset) / this.scale; }
  get door(): Point {
    // Keep the house interaction reachable even when the panoramic art is cropped on phones.
    return { x: Math.min(this.toWorld(this.width - 48), 1080), y: this.width <= 700 ? 480 : 444 };
  }
}
