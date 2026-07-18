declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import type { BufferGeometry, Material, Object3D } from 'three';

  export interface GLTF {
    scene: Object3D;
    scenes: Object3D[];
    cameras: Array<unknown>;
    animations: Array<unknown>;
    parser: unknown;
  }

  export class GLTFLoader {
    constructor();
    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (error: Error) => void
    ): void;
  }
}
