import { Plugin } from 'obsidian';
import { STPView, STP_VIEW_TYPE } from './stp-view';

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

    console.log('STP Viewer plugin loaded');
  }

  onunload() {}
}
