import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getSettings, subscribeToSettings } from './lib/settings';
import { applyTheme } from './lib/themes';

let didShow = false;

async function configureTheme() {
  const settings = getSettings();
  applyTheme(settings);

  if (!didShow) {
    didShow = true;
    await getCurrentWebviewWindow().show();
  }
}

configureTheme().catch((err) => console.log('Failed to configure theme', err));

subscribeToSettings(() => {
  configureTheme().catch((err) => console.log('Failed to configure theme', err));
});
