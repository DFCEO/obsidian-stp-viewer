import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { STPViewer } from './viewer';

export const STP_VIEW_TYPE = 'stp-viewer';

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

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.classList.add('stp-viewer-container');

    this.toolbarEl = root.createDiv('stp-viewer-toolbar');
    this.buildToolbar();

    this.canvasWrap = root.createDiv('stp-viewer-canvas-wrap');

    this.infoEl = root.createDiv('stp-viewer-info');
    this.setInfo('Ready');
  }

  async setState(state: any, result: any): Promise<void> {
    if (state?.file) {
      await this.loadFileByPath(state.file);
    }
    return super.setState(state, result);
  }

  private async loadFileByPath(filePath: string) {
    if (filePath === this.currentFilePath) return;
    this.currentFilePath = filePath;

    const file = this.app.vault.getFileByPath(filePath);
    if (!file) {
      this.showError(`File not found: ${filePath}`);
      return;
    }
    await this.loadSTPFile(file);
  }

  private buildToolbar() {
    if (!this.toolbarEl) return;
    this.toolbarEl.empty();

    const views: [string, string][] = [
      ['iso', 'ISO'], ['front', 'Front'], ['right', 'Right'], ['top', 'Top'],
    ];
    for (const [key, label] of views) {
      const btn = this.toolbarEl.createEl('button', { text: label });
      btn.addEventListener('click', () => this.viewer?.setView(key as any));
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

    // Edge toggle
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
    oneBtn.addEventListener('click', () => this.viewer?.setScale1To1());

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
    fitBtn.addEventListener('click', () => this.viewer?.fitCameraToModel());

    const resetBtn = this.toolbarEl.createEl('button', { text: 'Reset' });
    resetBtn.addEventListener('click', () => {
      this.viewer?.setView('iso');
      this.viewer?.setDisplayMode('solid');
      this.displayMode = 'solid';
      this.solidBtn?.addClass('active');
      this.wireBtn?.removeClass('active');
    });
  }

  async loadSTPFile(file: TFile) {
    if (!this.canvasWrap) return;
    this.setInfo(`Loading: ${file.name}`);

    try {
      const arrayBuffer = await this.app.vault.readBinary(file);

      if (this.viewer) {
        this.viewer.dispose();
        this.viewer = null;
      }

      this.viewer = new STPViewer({
        container: this.canvasWrap,
        onProgress: (msg) => this.setInfo(msg),
        onLoaded: (stats) => {
          this.setInfo(`${file.name} — ${stats.meshes} parts, ${stats.triangles.toLocaleString()} △`);
        },
        onError: (err) => this.showError(err.message),
      });

      await this.viewer.loadSTP(arrayBuffer);
    } catch (err: any) {
      console.error('STP parse error:', err);
      this.showError(err.message || 'Failed to parse STP file');
    }
  }

  private setInfo(msg: string) {
    if (this.infoEl) this.infoEl.setText(msg);
  }

  private showError(msg: string) {
    if (!this.canvasWrap) return;
    this.canvasWrap.empty();
    const errDiv = this.canvasWrap.createDiv('stp-viewer-error');
    errDiv.createDiv('stp-viewer-error-icon').setText('⚠️');
    errDiv.createDiv('stp-viewer-error-msg').setText(msg);
    if (this.infoEl) this.infoEl.setText(`Error: ${msg}`);
  }

  async onClose() {
    this.viewer?.dispose();
    this.viewer = null;
  }
}
