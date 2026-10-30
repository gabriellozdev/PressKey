// Layouts físicos (formato 60%) e mapeamento caractere → teclas.
// Cada tecla: [code(s), legenda, legenda com shift, largura em unidades]
// Os codes seguem KeyboardEvent.code, que é posicional (independe do idioma).

const letters = (s) => [...s].map((ch) => ["Key" + ch, ch.toLowerCase(), ch, 1]);
const bottomRow = (altRight) => [
  ["ControlLeft", "Ctrl", "", 1.25], ["MetaLeft", "Win", "", 1.25], ["AltLeft", "Alt", "", 1.25],
  ["Space", "", "", 6.25], ["AltRight", altRight, "", 1.25], ["Fn", "Fn", "", 1.25],
  ["ContextMenu", "Menu", "", 1.25], ["ControlRight", "Ctrl", "", 1.25],
];
const numberRow = (escShift, sixShift) => [
  [["Escape", "Backquote"], "Esc", escShift, 1],
  ["Digit1", "1", "!", 1], ["Digit2", "2", "@", 1], ["Digit3", "3", "#", 1], ["Digit4", "4", "$", 1],
  ["Digit5", "5", "%", 1], ["Digit6", "6", sixShift, 1], ["Digit7", "7", "&", 1], ["Digit8", "8", "*", 1],
  ["Digit9", "9", "(", 1], ["Digit0", "0", ")", 1], ["Minus", "-", "_", 1], ["Equal", "=", "+", 1],
  ["Backspace", "Backspace", "", 2],
];

export const LAYOUTS = {
  ansi: [
    numberRow("~", "^"),
    [["Tab", "Tab", "", 1.5], ...letters("QWERTYUIOP"),
      ["BracketLeft", "[", "{", 1], ["BracketRight", "]", "}", 1], ["Backslash", "\\", "|", 1.5]],
    [["CapsLock", "Caps", "", 1.75], ...letters("ASDFGHJKL"),
      ["Semicolon", ";", ":", 1], ["Quote", "'", "\"", 1], ["Enter", "Enter", "", 2.25]],
    [["ShiftLeft", "Shift", "", 2.25], ...letters("ZXCVBNM"),
      ["Comma", ",", "<", 1], ["Period", ".", ">", 1], ["Slash", "/", "?", 1], ["ShiftRight", "Shift", "", 2.75]],
    bottomRow("Alt"),
  ],
  abnt2: [
    numberRow("\"", "¨"),
    [["Tab", "Tab", "", 1.5], ...letters("QWERTYUIOP"),
      ["BracketLeft", "´", "`", 1], ["BracketRight", "[", "{", 1], ["Enter", "Enter", "", 1.5]],
    [["CapsLock", "Caps", "", 1.75], ...letters("ASDFGHJKL"),
      ["Semicolon", "ç", "Ç", 1], ["Quote", "~", "^", 1], ["Backslash", "]", "}", 1], ["Enter", "", "", 1.25]],
    [["ShiftLeft", "Shift", "", 1.25], ["IntlBackslash", "\\", "|", 1], ...letters("ZXCVBNM"),
      ["Comma", ",", "<", 1], ["Period", ".", ">", 1], ["Slash", ";", ":", 1], ["IntlRo", "/", "?", 1],
      ["ShiftRight", "Shift", "", 1.75]],
    bottomRow("AltGr"),
  ],
};

// Tecla morta (e se precisa de shift) para cada acento, por layout.
const DEAD_KEYS = {
  "us-intl": { "́": ["Quote", false], "̀": ["Backquote", false], "̃": ["Backquote", true],
               "̂": ["Digit6", true], "̈": ["Quote", true] },
  abnt2: { "́": ["BracketLeft", false], "̀": ["BracketLeft", true], "̃": ["Quote", false],
           "̂": ["Quote", true], "̈": ["Digit6", true] },
};

// Códigos que não existem num 60% sem camada Fn — se aparecerem, o teclado é maior.
export const NON_60_CODES = /^(F\d+|Arrow|Numpad|Home|End|PageUp|PageDown|Insert|Delete|PrintScreen|ScrollLock|Pause)/;

export const layoutKey = (layout) => (layout === "abnt2" ? "abnt2" : "ansi");

export const LAYOUT_NAMES = { us: "US (ANSI)", "us-intl": "US Internacional", abnt2: "ABNT2" };
export const FORM_NAMES = { 60: "60%", 65: "65% / 75%", tkl: "TKL / full size" };

/** Teclas que produzem `ch` no layout atual: [{ code, dead? }] */
export function keysFor(ch, layout, accents) {
  if (!ch) return [];
  if (ch === " ") return [{ code: "Space" }];
  if (layout === "abnt2" && (ch === "ç" || ch === "Ç")) {
    return ch === "Ç" ? [{ code: "Semicolon" }, { code: "ShiftLeft" }, { code: "ShiftRight" }] : [{ code: "Semicolon" }];
  }

  const out = [];
  const [base, ...marks] = ch.normalize("NFD");
  const mark = marks.join("");
  if (mark && accents === "keep") {
    const dead = DEAD_KEYS[layout]?.[mark];
    if (dead) out.push({ code: dead[0], dead: true });
  }

  for (const row of LAYOUTS[layoutKey(layout)]) {
    for (const [codes, label, shifted] of row) {
      const code = [].concat(codes).at(-1);
      if (label === base) return [...out, { code }];
      if (shifted === base) return [...out, { code }, { code: "ShiftLeft" }, { code: "ShiftRight" }];
    }
  }
  return out;
}
