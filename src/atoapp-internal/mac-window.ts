import { invoke } from '@tauri-apps/api/core';

export function setWindowTitle(title: string) {
  invoke('plugin:yaak-mac-window|set_title', { title }).catch(console.error);
}

export function setWindowTheme(bgColor: string) {
  invoke('plugin:yaak-mac-window|set_theme', { bgColor }).catch(console.error);
}

export function setNativeTitlebar(enable: boolean) {
  invoke('plugin:yaak-mac-window|set_native_titlebar', { enable }).catch(console.error);
}
