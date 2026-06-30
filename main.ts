import { Plugin, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import { STPView, STP_VIEW_TYPE } from './stp-view';

export default class STPViewerPlugin extends Plugin {
  async onload() {
    this.registerView(STP_VIEW_TYPE, (leaf) => new STPView(leaf));
    this.registerExtensions(['stp', 'step'], STP_VIEW_TYPE);

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && (file.extension === 'stp' || file.extension === 'step')) {
          this.app.workspace.getLeaf('tab').setViewState({
            type: STP_VIEW_TYPE,
            state: { file: file.path },
            active: true,
          });
        }
      })
    );

    // Path needed by viewer.ts to load occt-import-js WASM module
    (window as any).__STP_VIEWER_DIR__ =
      this.app.vault.adapter.getBasePath() + '/.obsidian/plugins/obsidian-stp-viewer/';

    console.log('STP Viewer plugin loaded');
  }

  onunload() {}
}
