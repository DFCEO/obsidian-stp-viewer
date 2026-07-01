import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, DataAdapter } from 'obsidian';
import { STPViewer } from './viewer';

/* ── occt type (match viewer.ts) ── */

interface OcctMeshAttribute {
  array: number[];
}

interface OcctMesh {
  name?: string;
  color?: [number, number, number];
  attributes: {
    position: OcctMeshAttribute;
    normal?: OcctMeshAttribute;
    color?: OcctMeshAttribute;
  };
  index: { array: number[] };
}

interface OcctInstance {
  ReadStepFile: (content: Uint8Array) => Promise<{ meshes: OcctMesh[] }>;
}

type OcctFactoryFn = (config: {
  wasmBinary?: ArrayBuffer;
  locateFile?: (path: string) => string;
}) => OcctInstance;

/* ── module-level occt cache ── */

let occtInstance: OcctInstance | null = null;
let occtInitPromise: Promise<OcctInstance> | null = null;

async function getOcct(adapter: DataAdapter, pluginDir: string): Promise<OcctInstance> {
  if (occtInstance) return occtInstance;
  if (occtInitPromise) return occtInitPromise;

  occtInitPromise = (async (): Promise<OcctInstance> => {
    // WASM: loaded via vault adapter (no fs, no fetch)
    const wasmBinary = await adapter.readBinary('.obsidian/plugins/stp-viewer/occt-import-js.wasm');

    // JS module: require() is available in Electron (desktop-only plugin)
    // Dynamic import() fails in Electron due to file:// path resolution issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const occtFactory = require(pluginDir + '/occt-import-js.js') as OcctFactoryFn;
    occtInstance = occtFactory({ wasmBinary, locateFile: () => '' });
    return occtInstance;
  })();

  return occtInitPromise;
}

/* ── plugin view ── */

export const STP_VIEW_TYPE = 'stp-viewer';

type ViewDirection = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso';

interface STPViewState {
  file?: string;
}

export class STPView extends ItemView {
  private viewer: STPViewer | null = null;
  private canvasWrap: HTMLElement | null = null;
  private toolbarEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;
  private displayMode: 'solid' | 'wireframe' = 'solid';
  private currentFilePath: string = '';
  private solidBtn: HTMLButtonElement | null = null;
  private wireBtn: HTMLButtonElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return STP_VIEW_TYPE; }
  getDisplayText(): string { return 'STP Viewer'; }
  getIcon(): string { return 'box'; }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.classList.add('stp-viewer-container');

    this.toolbarEl = root.createDiv('stp-viewer-toolbar');
    this.buildToolbar();

    this.canvasWrap = root.createDiv('stp-viewer-canvas-wrap');

    this.infoEl = root.createDiv('stp-viewer-info');
    this.setInfo('Ready');
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = state as STPViewState | undefined;
    if (s?.file) {
      await this.loadFileByPath(s.file);
    }
    return super.setState(state, result);
  }

  private getPluginBaseUrl(): string {
    // requestUrl with relative path works from the plugin's context
    // Plugin is loaded from <vault>/.obsidian/plugins/stp-viewer/
    return '';
  }

  private async loadFileByPath(filePath: string): Promise<void> {
    if (filePath === this.currentFilePath) return;
    this.currentFilePath = filePath;

    const file = this.app.vault.getFileByPath(filePath);
    if (!file) {
      this.showError(`File not found: ${filePath}`);
      return;
    }
    await this.loadSTPFile(file);
  }

  private buildToolbar(): void {
    if (!this.toolbarEl) return;
    this.toolbarEl.empty();

    const views: [ViewDirection, string][] = [
      ['iso',  'ISO'], ['front', 'Front'], ['right', 'Right'], ['top', 'Top'],
    ];
    for (const [key, label] of views) {
      const btn = this.toolbarEl.createEl('button', { text: label });
      btn.addEventListener('click', () => { this.viewer?.setView(key); });
    }

    this.toolbarEl.createDiv('separator');

    this.solidBtn = this.toolbarEl.createEl('button', { text: 'Solid' });
    this.solidBtn.addClass('active');
    this.wireBtn = this.toolbarEl.createEl('button', { text: 'Wire' });

    this.solidBtn.addEventListener('click', () => {
      this.displayMode = 'solid';
      this.solidBtn?.addClass('active');
      this.wireBtn?.removeClass('active');
      this.viewer?.setDisplayMode('solid');
    });
    this.wireBtn.addEventListener('click', () => {
      this.displayMode = 'wireframe';
      this.wireBtn?.addClass('active');
      this.solidBtn?.removeClass('active');
      this.viewer?.setDisplayMode('wireframe');
    });

    let edgesOn = false;
    const edgeBtn = this.toolbarEl.createEl('button', { text: 'Edges' });
    edgeBtn.addEventListener('click', () => {
      edgesOn = !edgesOn;
      if (edgesOn) edgeBtn.addClass('active');
      else edgeBtn.removeClass('active');
      this.viewer?.setEdgeVisible(edgesOn);
    });

    this.toolbarEl.createDiv('separator');

    const oneBtn = this.toolbarEl.createEl('button', { text: '1:1' });
    oneBtn.title = 'Actual size';
    oneBtn.addEventListener('click', () => { this.viewer?.setScale1To1(); });

    const fitBtn = this.toolbarEl.createEl('button', { text: 'Fit' });

    this.toolbarEl.createDiv('separator');

    let axesOn = true;
    const axesBtn = this.toolbarEl.createEl('button', { text: 'XYZ' });
    axesBtn.addClass('active');
    axesBtn.addEventListener('click', () => {
      axesOn = !axesOn;
      if (axesOn) axesBtn.addClass('active');
      else axesBtn.removeClass('active');
      this.viewer?.setAxesVisible(axesOn);
    });
    fitBtn.addEventListener('click', () => { this.viewer?.fitCameraToModel(); });

    const resetBtn = this.toolbarEl.createEl('button', { text: 'Reset' });
    resetBtn.addEventListener('click', () => {
      this.viewer?.setView('iso');
      this.viewer?.setDisplayMode('solid');
      this.displayMode = 'solid';
      this.solidBtn?.addClass('active');
      this.wireBtn?.removeClass('active');
    });
  }

  async loadSTPFile(file: TFile): Promise<void> {
    if (!this.canvasWrap) return;
    this.setInfo(`Loading: ${file.name}`);

    try {
      const arrayBuffer = await this.app.vault.readBinary(file);

      if (this.viewer) {
        this.viewer.dispose();
        this.viewer = null;
      }

      // Initialize occt with absolute file paths (Electron app:// breaks relatives)
      this.setInfo('Initializing OpenCascade...');
      // Initialize occt: WASM via adapter, JS via require (Electron-safe)
      this.setInfo('Initializing OpenCascade...');
      const basePath = (this.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath();
      const pluginDir = basePath + '/.obsidian/plugins/stp-viewer';
      const occt = await getOcct(this.app.vault.adapter, pluginDir);

      this.viewer = new STPViewer({
        container: this.canvasWrap,
        occt,
        onProgress: (msg: string) => { this.setInfo(msg); },
        onLoaded: (stats) => {
          this.setInfo(`${file.name} \u2014 ${stats.meshes} parts, ${stats.triangles.toLocaleString()} \u25b3`);
        },
        onError: (err: Error) => { this.showError(err.message); },
      });

      await this.viewer.loadSTP(arrayBuffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to parse STP file';
      console.error('STP parse error:', message);
      this.showError(message);
    }
  }

  private setInfo(msg: string): void {
    if (this.infoEl) this.infoEl.setText(msg);
  }

  private showError(msg: string): void {
    if (!this.canvasWrap) return;
    this.canvasWrap.empty();
    const errDiv = this.canvasWrap.createDiv('stp-viewer-error');
    errDiv.createDiv('stp-viewer-error-icon').setText('\u26a0\ufe0f');
    errDiv.createDiv('stp-viewer-error-msg').setText(msg);
    if (this.infoEl) this.infoEl.setText(`Error: ${msg}`);
  }

  async onClose(): Promise<void> {
    this.viewer?.dispose();
    this.viewer = null;
  }
}
