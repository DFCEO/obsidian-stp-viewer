import { Plugin } from 'obsidian';
import { STPView, STP_VIEW_TYPE } from './stp-view';

declare global {
  interface Window {
    __STP_VIEWER_DIR__?: string;
  }
}

export default class STPViewerPlugin extends Plugin {
  async onload() {
    this.registerView(STP_VIEW_TYPE, (leaf) => new STPView(leaf));
    this.registerExtensions(['stp', 'step'], STP_VIEW_TYPE);

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && (file.extension === 'stp' || file.extension === 'step')) {
          void this.app.workspace.getLeaf('tab').setViewState({
            type: STP_VIEW_TYPE,
            state: { file: file.path },
            active: true,
          });
        }
      })
    );

    // Path needed by viewer.ts to load occt-import-js WASM module
    // getBasePath exists on FileSystemAdapter at runtime but not in public types
    interface FileSystemAdapter { getBasePath(): string; }
    const configDir = this.app.vault.configDir;
    const basePath = (this.app.vault.adapter as unknown as FileSystemAdapter).getBasePath();
    window.__STP_VIEWER_DIR__ = `${basePath}/${configDir}/plugins/stp-viewer/`;

    console.log('STP Viewer plugin loaded');
  }

  onunload() {}
}
