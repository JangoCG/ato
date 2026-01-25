import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { type } from "@tauri-apps/plugin-os";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./main.css";
import "./milkdown/crepe-common.css";
import "./milkdown/crepe.css";
import "./milkdown/crepe-dark.css";
import "./milkdown/crepe-overrides.css";
import App from "./App";
import { SettingsPage } from "./components/SettingsWindow";
import { queryClient } from "./lib/queryClient";
import "./theme";

// Detect if this is the settings window
const urlParams = new URLSearchParams(window.location.search);
const isSettingsWindow = urlParams.get("window") === "settings";

const osType = type();
document.documentElement.setAttribute("data-platform", osType);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isSettingsWindow ? <SettingsPage /> : <App />}
    </QueryClientProvider>
  </React.StrictMode>,
);
