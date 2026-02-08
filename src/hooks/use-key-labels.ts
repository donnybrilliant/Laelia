import { useEffect, useState } from "react";

// Physical key codes we use for shortcuts (layout-independent).
// Labels vary by keyboard layout (QWERTY, AZERTY, QWERTZ, etc.)
const EXTENSION_CODES = ["Digit9", "Digit0", "Minus", "Equal"] as const;
const KEYBOARD_FIRST = "KeyZ";
const KEYBOARD_LAST = "Comma";

// Locale-based fallback when Keyboard API is unavailable or returns unhelpful values
function getFallbackLabel(code: string, locale: string): string {
  const lang = (locale || "en").split("-")[0];
  const qwertz: Partial<Record<string, string>> = { KeyZ: "Y" }; // German: Z and Y swapped
  const azerty: Partial<Record<string, string>> = {
    KeyZ: "W",
    Comma: ";",
  }; // French
  const norwegian: Partial<Record<string, string>> = {
    Minus: "-",
    Equal: "´",
    Comma: "-",
  }; // Norwegian: Equal key = ´, key right of M = -
  const swedishFinnish: Partial<Record<string, string>> = {
    Equal: "+",
  }; // Swedish/Finnish: Equal key = +
  const danish: Partial<Record<string, string>> = {
    Minus: "-",
    Equal: "´",
    Comma: "-",
  }; // Danish: same as Norwegian (DK/NO layout pair)
  const spanish: Partial<Record<string, string>> = {
    Equal: "º",
  }; // Spanish (Spain): Equal key = º
  const map: Partial<Record<string, string>> =
    lang === "de"
      ? qwertz
      : lang === "fr"
        ? azerty
        : lang === "no" || lang === "nb" || lang === "nn"
          ? norwegian
          : lang === "sv" || lang === "fi"
            ? swedishFinnish
            : lang === "da"
              ? danish
              : lang === "es"
                ? spanish
                : {};
  return map[code] ?? getDefaultLabel(code);
}

function getDefaultLabel(code: string): string {
  const defaults: Record<string, string> = {
    Digit9: "9",
    Digit0: "0",
    Minus: "-",
    Equal: "=",
    KeyZ: "Z",
    Comma: ",",
  };
  return defaults[code] ?? code;
}

// Locales where we prefer fallback over Keyboard API (API can return misleading chars)
const PREFER_FALLBACK_LOCALES = ["no", "nb", "nn", "sv", "da", "fi", "es"];

function getLabelFromMap(
  code: string,
  layoutMap: Map<string, string> | null,
  locale: string
): string {
  const lang = (locale || "en").split("-")[0];
  const useFallback = PREFER_FALLBACK_LOCALES.includes(lang);
  if (!useFallback && layoutMap) {
    const v = layoutMap.get(code);
    if (v) return v;
  }
  return getFallbackLabel(code, locale);
}

export function useKeyLabels(): {
  extensionsLabel: string;
  keyboardLabel: string;
} {
  const [layoutMap, setLayoutMap] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      keyboard?: { getLayoutMap?(): Promise<{ get(key: string): string | undefined }> };
    };
    const keyboard = nav.keyboard;
    if (keyboard?.getLayoutMap) {
      keyboard
        .getLayoutMap()
        .then((map) => {
          const m = new Map<string, string>();
          const codes = [...EXTENSION_CODES, KEYBOARD_FIRST, KEYBOARD_LAST];
          for (const code of codes) {
            const v = map.get(code);
            if (typeof v === "string" && v.length > 0) m.set(code, v);
          }
          if (m.size > 0) setLayoutMap(m);
        })
        .catch(() => {});
    }
  }, []);

  const locale = typeof navigator !== "undefined" ? navigator.language : "en";

  const extFirst = getLabelFromMap(EXTENSION_CODES[0], layoutMap, locale);
  const extLast = getLabelFromMap(EXTENSION_CODES[EXTENSION_CODES.length - 1], layoutMap, locale);
  const extensionsLabel = `Extensions (${extFirst}–${extLast})`;

  const first = getLabelFromMap(KEYBOARD_FIRST, layoutMap, locale);
  const last = getLabelFromMap(KEYBOARD_LAST, layoutMap, locale);
  const keyboardLabel = `Keyboard (${first}–${last} keys)`;

  return { extensionsLabel, keyboardLabel };
}
