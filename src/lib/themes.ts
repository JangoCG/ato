import type { AppSettings } from "./settings";

export type ThemeDefinition = {
  id: string;
  label: string;
  dark: boolean;
};

type ThemeDefinitionWithColors = ThemeDefinition & {
  base: {
    surface: string;
    surfaceHighlight?: string;
    text: string;
    textSubtle?: string;
    textSubtlest?: string;
    border?: string;
    primary?: string;
    secondary?: string;
    info?: string;
    success?: string;
    notice?: string;
    warning?: string;
    danger?: string;
  };
  components?: {
    sidebar?: {
      surface?: string;
      border?: string;
      backdrop?: string;
    };
    appHeader?: {
      surface?: string;
      border?: string;
      backdrop?: string;
    };
  };
};

export const themes: ThemeDefinitionWithColors[] = [
  {
    id: "ato-dark",
    label: "Ato",
    dark: true,
    base: {
      surface: "hsl(244,23%,14%)",
      surfaceHighlight: "hsl(244,23%,20%)",
      text: "hsl(245,23%,85%)",
      textSubtle: "hsl(245,18%,58%)",
      textSubtlest: "hsl(245,18%,45%)",
      border: "hsl(244,23%,25%)",
      primary: "hsl(266,100%,79%)",
      secondary: "hsl(245,23%,60%)",
      info: "hsl(206,100%,63%)",
      success: "hsl(150,99%,44%)",
      notice: "hsl(48,80%,63%)",
      warning: "hsl(28,100%,61%)",
      danger: "hsl(342,90%,68%)",
    },
    components: {
      sidebar: {
        surface: "hsl(243,23%,16%)",
        border: "hsl(244,23%,22%)",
      },
      appHeader: {
        surface: "hsl(244,23%,12%)",
        border: "hsl(244,23%,21%)",
      },
    },
  },
  {
    id: "ato-light",
    label: "Ato",
    dark: false,
    base: {
      surface: "hsl(0,0%,100%)",
      surfaceHighlight: "hsl(218,24%,87%)",
      text: "hsl(217,24%,10%)",
      textSubtle: "hsl(217,24%,40%)",
      textSubtlest: "hsl(217,24%,58%)",
      border: "hsl(217,22%,90%)",
      primary: "hsl(266,100%,60%)",
      secondary: "hsl(220,24%,50%)",
      info: "hsl(206,100%,40%)",
      success: "hsl(139,66%,34%)",
      notice: "hsl(45,100%,34%)",
      warning: "hsl(30,100%,36%)",
      danger: "hsl(335,75%,48%)",
    },
    components: {
      sidebar: {
        surface: "hsl(220,20%,98%)",
        border: "hsl(217,22%,88%)",
      },
    },
  },
  {
    id: "nord",
    label: "Nord",
    dark: true,
    base: {
      surface: "hsl(220,16%,22%)",
      surfaceHighlight: "hsl(220,14%,28%)",
      text: "hsl(220,28%,93%)",
      textSubtle: "hsl(220,26%,90%)",
      textSubtlest: "hsl(220,24%,86%)",
      primary: "hsl(193,38%,68%)",
      secondary: "hsl(210,34%,63%)",
      info: "hsl(174,25%,69%)",
      success: "hsl(89,26%,66%)",
      notice: "hsl(40,66%,73%)",
      warning: "hsl(17,48%,64%)",
      danger: "hsl(353,43%,56%)",
    },
    components: {
      sidebar: {
        surface: "hsl(220,16%,22%)",
      },
      appHeader: {
        surface: "hsl(220,14%,28%)",
      },
    },
  },
  {
    id: "nord-light",
    label: "Nord Light",
    dark: false,
    base: {
      surface: "#eceff4",
      surfaceHighlight: "#e5e9f0",
      text: "#24292e",
      textSubtle: "#444d56",
      textSubtlest: "#586069",
      primary: "#2188ff",
      secondary: "#586069",
      info: "#005cc5",
      success: "#28a745",
      notice: "#e36209",
      warning: "#e36209",
      danger: "#cb2431",
    },
    components: {
      sidebar: {
        surface: "#e5e9f0",
      },
      appHeader: {
        surface: "#e5e9f0",
      },
    },
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    dark: true,
    base: {
      surface: "hsl(240,21%,12%)",
      text: "hsl(226,64%,88%)",
      textSubtle: "hsl(228,24%,72%)",
      textSubtlest: "hsl(230,13%,55%)",
      primary: "hsl(267,83%,80%)",
      secondary: "hsl(227,35%,80%)",
      info: "hsl(217,92%,76%)",
      success: "hsl(115,54%,76%)",
      notice: "hsl(41,86%,83%)",
      warning: "hsl(23,92%,75%)",
      danger: "hsl(343,81%,75%)",
    },
    components: {
      sidebar: {
        surface: "hsl(240,21%,15%)",
        border: "hsl(240,21%,19%)",
      },
      appHeader: {
        surface: "hsl(240,23%,9%)",
        border: "hsl(240,22%,18%)",
      },
    },
  },
  {
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    dark: false,
    base: {
      surface: "hsl(220,23%,95%)",
      text: "hsl(234,16%,35%)",
      textSubtle: "hsl(233,10%,47%)",
      textSubtlest: "hsl(231,10%,59%)",
      primary: "hsl(266,85%,58%)",
      secondary: "hsl(233,10%,47%)",
      info: "hsl(231,97%,72%)",
      success: "hsl(183,74%,35%)",
      notice: "hsl(35,77%,49%)",
      warning: "hsl(22,99%,52%)",
      danger: "hsl(355,76%,59%)",
    },
    components: {
      sidebar: {
        surface: "hsl(220,22%,92%)",
        border: "hsl(220,22%,87%)",
      },
      appHeader: {
        surface: "hsl(220,21%,89%)",
        border: "hsl(220,22%,87%)",
      },
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    dark: true,
    base: {
      surface: "hsl(231,15%,18%)",
      surfaceHighlight: "hsl(230,15%,24%)",
      text: "hsl(60,30%,96%)",
      textSubtle: "hsl(232,14%,65%)",
      textSubtlest: "hsl(232,14%,50%)",
      primary: "hsl(265,89%,78%)",
      secondary: "hsl(225,27%,51%)",
      info: "hsl(191,97%,77%)",
      success: "hsl(135,94%,65%)",
      notice: "hsl(65,92%,76%)",
      warning: "hsl(31,100%,71%)",
      danger: "hsl(0,100%,67%)",
    },
    components: {
      sidebar: {
        backdrop: "hsl(230,15%,24%)",
      },
      appHeader: {
        backdrop: "hsl(235,14%,15%)",
      },
    },
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    dark: true,
    base: {
      surface: "hsl(235, 21%, 13%)",
      surfaceHighlight: "hsl(235, 18%, 18%)",
      text: "hsl(229, 28%, 76%)",
      textSubtle: "hsl(232, 18%, 52%)",
      textSubtlest: "hsl(234, 16%, 40%)",
      primary: "hsl(266, 100%, 78%)",
      secondary: "hsl(232, 18%, 52%)",
      info: "hsl(217, 100%, 73%)",
      success: "hsl(158, 57%, 63%)",
      notice: "hsl(40, 67%, 65%)",
      warning: "hsl(25, 75%, 58%)",
      danger: "hsl(358, 100%, 70%)",
    },
    components: {
      sidebar: {
        surface: "hsl(235, 21%, 11%)",
        border: "hsl(235, 18%, 16%)",
      },
      appHeader: {
        surface: "hsl(235, 21%, 9%)",
        border: "hsl(235, 18%, 14%)",
      },
    },
  },
  {
    id: "tokyo-night-day",
    label: "Tokyo Night Day",
    dark: false,
    base: {
      surface: "hsl(212, 100%, 98%)",
      surfaceHighlight: "hsl(212, 60%, 93%)",
      text: "hsl(233, 26%, 27%)",
      textSubtle: "hsl(232, 18%, 45%)",
      textSubtlest: "hsl(232, 12%, 55%)",
      primary: "hsl(290, 80%, 45%)",
      secondary: "hsl(232, 18%, 50%)",
      info: "hsl(217, 88%, 52%)",
      success: "hsl(160, 75%, 35%)",
      notice: "hsl(41, 80%, 40%)",
      warning: "hsl(20, 80%, 48%)",
      danger: "hsl(359, 65%, 48%)",
    },
    components: {
      sidebar: {
        surface: "hsl(212, 60%, 95%)",
        border: "hsl(212, 40%, 88%)",
      },
      appHeader: {
        surface: "hsl(212, 60%, 93%)",
        border: "hsl(212, 40%, 86%)",
      },
    },
  },
];

let currentSystemAppearance: "light" | "dark" =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

// Listen for system appearance changes
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    currentSystemAppearance = e.matches ? "dark" : "light";
  });
}

export function applyTheme(settings: AppSettings): void {
  const resolvedAppearance = settings.appearance === "system" ? currentSystemAppearance : settings.appearance;
  const root = document.documentElement;
  root.dataset.resolvedAppearance = resolvedAppearance;
  root.style.colorScheme = resolvedAppearance;

  const pickTheme = (id: string, preferDark: boolean) => {
    const match = themes.find((theme) => theme.id === id && theme.dark === preferDark);
    if (match) return match;
    const fallback =
      themes.find((theme) => theme.dark === preferDark && theme.id === (preferDark ? "ato-dark" : "ato-light")) ??
      themes.find((theme) => theme.dark === preferDark);
    return fallback ?? themes[0];
  };

  const darkThemeDef = pickTheme(settings.darkTheme, true);
  const lightThemeDef = pickTheme(settings.lightTheme, false);
  const activeTheme = resolvedAppearance === "dark" ? darkThemeDef : lightThemeDef;

  const setVar = (name: string, value?: string) => {
    if (!value) return;
    root.style.setProperty(`--${name}`, value);
  };

  setVar("surface", activeTheme.base.surface);
  setVar("surfaceHighlight", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  // surfaceActive is a lighter version of surfaceHighlight for subtle selection
  const highlightColor = activeTheme.base.surfaceHighlight ?? activeTheme.base.surface;
  setVar("surfaceActive", `color-mix(in srgb, ${highlightColor} 50%, ${activeTheme.base.surface})`);
  setVar("text", activeTheme.base.text);
  setVar("textSubtle", activeTheme.base.textSubtle ?? activeTheme.base.text);
  setVar("textSubtlest", activeTheme.base.textSubtlest ?? activeTheme.base.text);
  setVar("border", activeTheme.base.border ?? activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("borderSubtle", activeTheme.base.border ?? activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("borderFocus", activeTheme.base.primary);
  setVar("primary", activeTheme.base.primary);
  setVar("secondary", activeTheme.base.secondary);
  setVar("info", activeTheme.base.info);
  setVar("success", activeTheme.base.success);
  setVar("notice", activeTheme.base.notice);
  setVar("warning", activeTheme.base.warning);
  setVar("danger", activeTheme.base.danger);

  const sidebarSurface =
    activeTheme.components?.sidebar?.surface ?? activeTheme.components?.sidebar?.backdrop;
  const appHeaderSurface =
    activeTheme.components?.appHeader?.surface ?? activeTheme.components?.appHeader?.backdrop;

  setVar("sidebarSurface", sidebarSurface ?? activeTheme.base.surface);
  setVar("sidebarBorder", activeTheme.components?.sidebar?.border ?? activeTheme.base.border);
  setVar("appHeaderSurface", appHeaderSurface ?? activeTheme.base.surface);
  setVar("appHeaderBorder", activeTheme.components?.appHeader?.border ?? activeTheme.base.border);

  // Milkdown Crepe theme variables mapped to app theme
  setVar("crepe-color-background", activeTheme.base.surface);
  setVar("crepe-color-surface", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-surface-low", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-on-background", activeTheme.base.text);
  setVar("crepe-color-on-surface", activeTheme.base.text);
  setVar("crepe-color-on-surface-variant", activeTheme.base.textSubtle ?? activeTheme.base.text);
  setVar("crepe-color-outline", activeTheme.base.border ?? activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-primary", activeTheme.base.textSubtle ?? activeTheme.base.text);
  setVar("crepe-color-secondary", activeTheme.base.secondary ?? activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-on-secondary", activeTheme.base.text);
  setVar("crepe-color-inverse", activeTheme.base.text);
  setVar("crepe-color-on-inverse", activeTheme.base.surface);
  setVar("crepe-color-inline-code", activeTheme.base.textSubtle ?? activeTheme.base.text);
  setVar("crepe-color-error", activeTheme.base.danger ?? activeTheme.base.text);
  setVar("crepe-color-hover", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-selected", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-color-inline-area", activeTheme.base.surfaceHighlight ?? activeTheme.base.surface);
  setVar("crepe-font-title", "var(--font-family-interface)");
  setVar("crepe-font-default", "var(--font-family-interface)");
  setVar("crepe-font-code", "var(--font-family-editor)");
  setVar("crepe-shadow-1", `0 1px 2px 0 var(--shadow)`);
  setVar("crepe-shadow-2", `0 2px 6px 0 var(--shadow)`);
}
