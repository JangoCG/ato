
import {getSettings, subscribeToSettings} from './lib/settings';

function setFontSizeOnDocument(fontSize: number) {
  document.documentElement.style.fontSize = `${fontSize}px`;
}

// Set initial font size
const settings = getSettings();
setFontSizeOnDocument(settings.interfaceFontSize);

// Listen for settings changes
subscribeToSettings((updatedSettings) => {
  setFontSizeOnDocument(updatedSettings.interfaceFontSize);
});
