// Explicit exports keep unused Three.js loaders, controls, and materials out of
// the optional graphics chunk. This module is imported only after visibility.
export {
  Scene, Group, OrthographicCamera, AmbientLight, DirectionalLight,
  BoxGeometry, MeshLambertMaterial, InstancedMesh, Object3D, WebGLRenderer,
} from 'three';
