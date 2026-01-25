import { atom } from 'jotai';
import { getSettings, subscribeToSettings, type AppSettings } from '../lib/settings';

export type Settings = {
  appearance: AppSettings['appearance'];
  themeLight: string;
  themeDark: string;
  interfaceScale: number;
  hideWindowControls: boolean;
  useNativeTitlebar: boolean;
};

function mapSettings(settings: AppSettings): Settings {
  return {
    appearance: settings.appearance,
    themeLight: settings.lightTheme,
    themeDark: settings.darkTheme,
    interfaceScale: 1,
    hideWindowControls: false,
    useNativeTitlebar: settings.useNativeTitlebar,
  };
}

export const settingsAtom = atom<Settings>(mapSettings(getSettings()));

settingsAtom.onMount = (set) => {
  return subscribeToSettings((settings) => {
    set(mapSettings(settings));
  });
};
