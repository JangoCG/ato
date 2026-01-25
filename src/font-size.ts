
import {getSettings, subscribeToSettings} from './lib/settings';

function setFontSizeOnDocument(fontSize: number) {
  console.log('[font-size] Setting root font size to:', fontSize, 'px');
  document.documentElement.style.fontSize = `${fontSize}px`;
  console.log(
      '[font-size] Actual computed fontSize:',
      getComputedStyle(document.documentElement).fontSize);
}

// Set initial font size
const settings = getSettings();
console.log('[font-size] Settings loaded:', settings);
setFontSizeOnDocument(settings.interfaceFontSize);

// Listen for settings changes
subscribeToSettings((updatedSettings) => {
  console.log('[font-size] Settings updated:', updatedSettings);
  setFontSizeOnDocument(updatedSettings.interfaceFontSize);
});
