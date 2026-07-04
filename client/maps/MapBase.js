import * as THREE from 'three';

/**
 * Base class for all game maps.
 *
 * Conventions:
 * - Lights must be added as children of `group`.
 * - `group` is added to the scene at the origin and never transformed, so
 *   local coordinates equal world coordinates.
 * - Rotated collidable boxes get their enlarged world AABB, so collidable
 *   `rotationY` should be multiples of `Math.PI / 2`.
 * - Spawn vectors (`policeSpawns`, `monkeySpawns`) are FEET positions on
 *   solid ground.
 */
export class MapBase {
  constructor() {
    this.id = 'BASE';
    this.name = 'Base Map';
    this.group = new THREE.Group();
    this.colliders = [];
    this.policeSpawns = [];
    this.monkeySpawns = [];
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-80, -10, -80),
      new THREE.Vector3(80, 50, 80)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0x87ceeb,
      fog: { color: 0x87ceeb, near: 40, far: 180 }
    };
  }

  /** Override; synchronous construction of everything. */
  build() {}

  /**
   * Override optional; per-frame visual animation only.
   * @param {number} _dt seconds since last frame
   * @param {number} _time total elapsed seconds
   */
  update(_dt, _time) {}

  /**
   * Disposes geometries, materials (including material arrays) and any
   * material `.map` textures in the group, then clears the colliders array.
   */
  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });
    this.colliders.length = 0;
  }

  /**
   * Adds a box mesh to the group. `x`,`z` are the box center and `y` is the
   * box BOTTOM (`mesh.position.y = y + height / 2`).
   * @param {{ width:number, height:number, depth:number, x:number, y:number, z:number,
   *   material:(number|THREE.Material), rotationY?:number,
   *   castShadow?:boolean, receiveShadow?:boolean, collider?:boolean }} opts
   *   `material` may be a hex color number (wrapped in MeshStandardMaterial)
   *   or a THREE.Material instance used as-is.
   * @returns {THREE.Mesh}
   */
  addSolidBox({
    width, height, depth, x, y, z, material,
    rotationY = 0, castShadow = true, receiveShadow = true, collider = true
  }) {
    const mat = typeof material === 'number'
      ? new THREE.MeshStandardMaterial({ color: material })
      : material;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y + height / 2, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.group.add(mesh);
    if (collider) this.addColliderFromMesh(mesh);
    return mesh;
  }

  /**
   * Registers the world-space AABB of an object as a collider.
   * @param {THREE.Object3D} object3D
   * @returns {THREE.Box3} the registered collider
   */
  addColliderFromMesh(object3D) {
    object3D.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object3D);
    this.colliders.push(box);
    return box;
  }

  /**
   * Registers a prebuilt world-space AABB as a collider.
   * @param {THREE.Box3} box3
   * @returns {THREE.Box3} the registered collider
   */
  addCollider(box3) {
    this.colliders.push(box3);
    return box3;
  }
}
