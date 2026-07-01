import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { OcctInstance, OcctMesh } from 'occt-import-js';

/* ── public types ── */

export interface LoadedStats {
  meshes: number;
  triangles: number;
}

export interface STPViewerOptions {
  container: HTMLElement;
  occt: OcctInstance;
  onProgress?: (msg: string) => void;
  onLoaded?: (stats: LoadedStats) => void;
  onError?: (err: Error) => void;
}

/* ── STPViewer ── */

export class STPViewer {
  private container: HTMLElement;
  private occt: OcctInstance;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private modelGroup: THREE.Group;
  private edgeGroup: THREE.Group;
  private grid: THREE.GridHelper;
  private axesGroup: THREE.Group;
  private resizeObserver: ResizeObserver;
  private animationId: number = 0;
  private onProgress?: (msg: string) => void;
  private onLoaded?: (stats: LoadedStats) => void;
  private onError?: (err: Error) => void;

  constructor(options: STPViewerOptions) {
    this.container = options.container;
    this.occt = options.occt;
    this.onProgress = options.onProgress;
    this.onLoaded = options.onLoaded;
    this.onError = options.onError;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.edgeGroup = new THREE.Group();
    this.edgeGroup.visible = false;
    this.scene.add(this.edgeGroup);

    this.grid = this.makeGrid(200, -100);
    this.scene.add(this.grid);

    this.axesGroup = new THREE.Group();
    this.axesGroup.visible = false;
    this.scene.add(this.axesGroup);

    this.setupLights();

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = new ResizeObserver(() => { this.onResize(); });
    this.resizeObserver.observe(this.container);

    this.animate();
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(5, 10, 7);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 0, -3);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.4));
  }

  private makeGrid(size: number, y: number): THREE.GridHelper {
    const g = new THREE.GridHelper(size, 40, 0x888888, 0x444444);
    g.position.y = y;
    return g;
  }

  private animate = (): void => {
    this.animationId = window.requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize: () => void = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  async loadSTP(data: ArrayBuffer): Promise<void> {
    this.onProgress?.('Parsing STEP file...');
    const result = await this.occt.ReadStepFile(new Uint8Array(data));

    if (!result.meshes || result.meshes.length === 0) {
      throw new Error('STEP file parsed but contains no geometry');
    }

    this.modelGroup.clear();
    this.edgeGroup.clear();

    let triangles = 0;

    for (const mesh of result.meshes) {
      if (!mesh.attributes?.position || !mesh.index) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.position.array), 3)
      );

      if (mesh.attributes.normal?.array) {
        geometry.setAttribute(
          'normal',
          new THREE.BufferAttribute(new Float32Array(mesh.attributes.normal.array), 3)
        );
      }
      if (mesh.attributes.color?.array) {
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(new Float32Array(mesh.attributes.color.array), 3)
        );
      }

      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.index.array), 1));
      geometry.computeBoundingSphere();

      const hasColor = Boolean(mesh.color && !mesh.attributes.color);
      const material = new THREE.MeshStandardMaterial({
        color: hasColor
          ? new THREE.Color(mesh.color![0], mesh.color![1], mesh.color![2])
          : 0x4a90d9,
        roughness: 0.5,
        metalness: 0.1,
      });

      const m = new THREE.Mesh(geometry, material);
      m.name = mesh.name || `part_${this.modelGroup.children.length}`;
      this.modelGroup.add(m);

      const edgeGeo = new THREE.EdgesGeometry(geometry, 30);
      const edgeLine = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x222222 })
      );
      edgeLine.name = m.name + '_edge';
      this.edgeGroup.add(edgeLine);

      triangles += (geometry.index?.count ?? 0) / 3;
    }

    this.fitCameraToModel();
    this.onLoaded?.({ meshes: this.modelGroup.children.length, triangles });
  }

  fitCameraToModel(): void {
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8;

    this.camera.position.set(
      center.x + dist * 0.8,
      center.y + dist * 0.6,
      center.z + dist
    );
    this.controls.target.copy(center);
    this.controls.update();

    // Grid
    this.scene.remove(this.grid);
    this.grid.dispose();
    this.grid = this.makeGrid(Math.max(maxDim * 2, 10), box.min.y - maxDim * 0.05);
    this.scene.add(this.grid);

    // Axes
    this.axesGroup.clear();
    this.buildThickAxes(maxDim * 0.15, maxDim * 0.005);
    this.axesGroup.position.set(center.x, center.y, center.z);
    this.axesGroup.position.y = box.min.y - maxDim * 0.05;
    this.axesGroup.visible = true;

    this.updateScaleBar(maxDim);
  }

  setView(dir: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso'): void {
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(this.modelGroup).getCenter(center);
    const d = this.camera.position.distanceTo(center);

    const views: Record<string, THREE.Vector3> = {
      front: new THREE.Vector3(0, 0, d),
      back: new THREE.Vector3(0, 0, -d),
      left: new THREE.Vector3(-d, 0, 0),
      right: new THREE.Vector3(d, 0, 0),
      top: new THREE.Vector3(0, d, 0),
      bottom: new THREE.Vector3(0, -d, 0),
      iso: new THREE.Vector3(d * 0.8, d * 0.6, d),
    };

    const pos = views[dir] || views.iso;
    this.camera.position.copy(center.clone().add(pos));
    this.controls.target.copy(center);
    this.controls.update();
  }

  setDisplayMode(mode: 'solid' | 'wireframe'): void {
    this.modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.wireframe = mode === 'wireframe';
      }
    });
  }

  setEdgeVisible(visible: boolean): void {
    this.edgeGroup.visible = visible;
  }

  setAxesVisible(visible: boolean): void {
    this.axesGroup.visible = visible;
  }

  setScale1To1(): void {
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);

    const dpr = window.devicePixelRatio || 1;
    const dpi = Math.max(96, 96 * dpr);
    const mmPerUnit = 25.4 / dpi;
    const screenH = this.renderer.domElement.clientHeight * mmPerUnit;
    const fovRad = (this.camera.fov / 2) * Math.PI / 180;
    const D = screenH / (2 * Math.tan(fovRad));

    this.camera.position.set(center.x, center.y, center.z + D);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private buildThickAxes(length: number, radius: number): void {
    const colors = [0xff3333, 0x33ff33, 0x3388ff];
    const labels = ['X', 'Y', 'Z'];
    const dirs = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];

    const doc = this.container.ownerDocument;

    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0 });

      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, 8), mat
      );
      cyl.position.copy(dirs[i].clone().multiplyScalar(length / 2));
      if (i === 0) cyl.rotation.z = -Math.PI / 2;
      else if (i === 2) cyl.rotation.x = Math.PI / 2;
      this.axesGroup.add(cyl);

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 3, length * 0.2, 8), mat
      );
      cone.position.copy(dirs[i].clone().multiplyScalar(length));
      if (i === 0) cone.rotation.z = -Math.PI / 2;
      else if (i === 2) cone.rotation.x = Math.PI / 2;
      this.axesGroup.add(cone);

      // Sprite label
      const canvas = doc.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#' + colors[i].toString(16).padStart(6, '0');
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[i], 32, 32);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, depthTest: false })
      );
      sprite.position.copy(dirs[i].clone().multiplyScalar(length * 1.3));
      sprite.scale.set(length * 0.2, length * 0.2, 1);
      this.axesGroup.add(sprite);
    }
  }

  updateScaleBar(maxDim: number): void {
    const old = this.container.querySelector('.stp-viewer-scale-bar');
    if (old) old.remove();

    const ref = this.roundToNice(maxDim * 0.35);
    const barPx = Math.min((ref / maxDim) * 200, 200);

    const wrap = this.container.ownerDocument.createElement('div');
    wrap.className = 'stp-viewer-scale-bar';

    const bar = this.container.ownerDocument.createElement('div');
    bar.className = 'stp-viewer-scale-bar-line';
    bar.style.width = `${barPx}px`;

    const label = this.container.ownerDocument.createElement('span');
    label.className = 'stp-viewer-scale-bar-label';
    label.textContent = ref.toFixed(0) + ' mm';

    wrap.appendChild(bar);
    wrap.appendChild(label);
    this.container.appendChild(wrap);
  }

  private roundToNice(this: void, n: number): number {
    const mag = 10 ** Math.floor(Math.log10(n));
    const norm = n / mag;
    const nice = norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10;
    return nice * mag;
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.grid.dispose();
    this.modelGroup.clear();
    this.edgeGroup.clear();
    this.axesGroup.clear();
    this.scene.clear();
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
