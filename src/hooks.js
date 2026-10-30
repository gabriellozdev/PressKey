import { useCallback, useEffect, useRef, useState } from "react";
import { NON_60_CODES } from "./lib/keyboard.js";
import { matches } from "./lib/text.js";
import { computeLive, computeResults } from "./lib/metrics.js";

// ---------------------------------------------------------------------------
// Preferências (localStorage é só conveniência; tudo funciona sem ele)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  duration: 60, accents: "strip", caps: true, punct: true, numbers: true, lang: "pt", source: "gutenberg",
  layout: "us", form: "60", avoidFn: true, profileLocked: false,
};

export function usePrefs() {
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("presskey") || "{}") }; }
    catch { return DEFAULTS; }
  });
  useEffect(() => {
    try { localStorage.setItem("presskey", JSON.stringify(prefs)); } catch {}
  }, [prefs]);
  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  return [prefs, update];
}

// Acentos que cada layout consegue digitar.
export const ACCENTS_FOR_LAYOUT = { us: "strip", "us-intl": "lenient", abnt2: "keep" };

// ---------------------------------------------------------------------------
// Detecção do teclado
// ---------------------------------------------------------------------------
export function useKeyboardDetection(prefs, update) {
  const [detection, setDetection] = useState({ source: null, layout: null, deadSeen: false, bigKeysSeen: false });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const applyLayout = useCallback((layout) => {
    if (prefsRef.current.profileLocked) return;
    update({ layout, accents: ACCENTS_FOR_LAYOUT[layout] });
  }, [update]);

  const detect = useCallback(async () => {
    setDetection({ source: null, layout: null, deadSeen: false, bigKeysSeen: false });
    try {
      if (!navigator.keyboard?.getLayoutMap) return;
      const map = await navigator.keyboard.getLayoutMap();
      const abnt = map.get("Semicolon") === "ç" || map.has("IntlRo") || map.get("Slash") === ";";
      const layout = abnt ? "abnt2" : "us";
      setDetection((d) => ({ ...d, source: "api", layout }));
      applyLayout(layout);
    } catch {}
  }, [applyLayout]);

  useEffect(() => { detect(); }, [detect]);

  // Observa as teclas reais para refinar o que a API não diz.
  const observe = useCallback((e) => {
    const p = prefsRef.current;
    if (e.key === "Dead" && p.layout === "us") {
      setDetection((d) => ({ ...d, deadSeen: true, source: "typing", layout: "us-intl" }));
      applyLayout("us-intl");
    }
    if ((e.key === "ç" || e.code === "IntlRo") && p.layout !== "abnt2") {
      setDetection((d) => ({ ...d, source: "typing", layout: "abnt2" }));
      applyLayout("abnt2");
    }
    if (NON_60_CODES.test(e.code) && p.form === "60") {
      setDetection((d) => (d.bigKeysSeen ? d : { ...d, bigKeysSeen: true }));
    }
  }, [applyLayout]);

  return { detection, detect, observe };
}

// ---------------------------------------------------------------------------
// Motor do teste
// ---------------------------------------------------------------------------
// O tempo vem sempre de performance.now(); o requestAnimationFrame só decide
// quando redesenhar o relógio, nunca soma tempo por conta própria.
export function useTypingTest(text, duration, accents) {
  const [typed, setTyped] = useState([]);
  const [phase, setPhaseState] = useState("idle"); // idle | running | done
  // Ref espelha o estado: teclas rápidas chegam antes do React re-renderizar.
  const phaseRef = useRef("idle");
  const setPhase = useCallback((p) => { phaseRef.current = p; setPhaseState(p); }, []);
  const [live, setLive] = useState({ remaining: duration, wpm: 0, accuracy: 100 });
  const [results, setResults] = useState(null);

  const startRef = useRef(0);
  const keystrokesRef = useRef([]);
  const typedRef = useRef([]);
  const frameRef = useRef(0);
  const deadlineRef = useRef(0);

  const reset = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    clearTimeout(deadlineRef.current);
    startRef.current = 0;
    keystrokesRef.current = [];
    typedRef.current = [];
    setTyped([]);
    setPhase("idle");
    setResults(null);
    setLive({ remaining: duration, wpm: 0, accuracy: 100 });
  }, [duration, setPhase]);

  useEffect(() => { reset(); }, [text, reset]);

  const finish = useCallback((endTime) => {
    if (phaseRef.current === "done") return;
    cancelAnimationFrame(frameRef.current);
    clearTimeout(deadlineRef.current);
    const elapsed = Math.min(endTime - startRef.current, duration * 1000);
    let finalCorrect = 0, finalWrong = 0;
    typedRef.current.forEach((ch, i) => (matches(ch, text[i], accents) ? finalCorrect++ : finalWrong++));
    setResults(computeResults(keystrokesRef.current, elapsed, finalCorrect, finalWrong));
    setPhase("done");
  }, [duration, text, accents, setPhase]);

  const loop = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    if (elapsed >= duration * 1000) return finish(startRef.current + duration * 1000);
    const remaining = Math.ceil(duration - elapsed / 1000);
    const { wpm, accuracy } = computeLive(keystrokesRef.current, elapsed);
    setLive((l) => (l.remaining === remaining && Math.round(l.wpm) === Math.round(wpm) && Math.round(l.accuracy) === Math.round(accuracy)
      ? l : { remaining, wpm, accuracy }));
    frameRef.current = requestAnimationFrame(loop);
  }, [duration, finish]);

  useEffect(() => () => { cancelAnimationFrame(frameRef.current); clearTimeout(deadlineRef.current); }, []);

  /** Retorna true se o caractere estava certo. */
  const typeChar = useCallback((ch) => {
    if (phaseRef.current === "done" || !text) return null;
    const now = performance.now();
    if (phaseRef.current === "idle") {
      startRef.current = now;
      setPhase("running");
      frameRef.current = requestAnimationFrame(loop);
      // Reserva: o navegador pausa requestAnimationFrame em abas ocultas.
      deadlineRef.current = setTimeout(() => finish(startRef.current + duration * 1000), duration * 1000 + 50);
    }
    const i = typedRef.current.length;
    if (i >= text.length) return null;
    const ok = matches(ch, text[i], accents);
    keystrokesRef.current.push({ t: now - startRef.current, ok, expected: text[i], typed: ch });
    typedRef.current = [...typedRef.current, ch];
    setTyped(typedRef.current);
    if (typedRef.current.length >= text.length) finish(now);
    return ok;
  }, [text, accents, duration, loop, finish, setPhase]);

  const backspace = useCallback((wholeWord) => {
    if (phaseRef.current !== "running" || !typedRef.current.length) return;
    const next = [...typedRef.current];
    do next.pop();
    while (wholeWord && next.length && text[next.length - 1] !== " ");
    typedRef.current = next;
    setTyped(next);
  }, [text]);

  return { typed, phase, live, results, typeChar, backspace, reset };
}
