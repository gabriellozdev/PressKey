import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TypingArea from "./components/TypingArea.jsx";
import Keyboard from "./components/Keyboard.jsx";
import Controls from "./components/Controls.jsx";
import Results from "./components/Results.jsx";
import ProfileDialog from "./components/ProfileDialog.jsx";
import { useKeyboardDetection, usePrefs, useTypingTest, ACCENTS_FOR_LAYOUT } from "./hooks.js";
import { buildText, fetchText } from "./lib/text.js";
import { FORM_NAMES, LAYOUT_NAMES, keysFor } from "./lib/keyboard.js";

const SHIFTS = new Set(["ShiftLeft", "ShiftRight"]);

export default function App() {
  const [prefs, update] = usePrefs();
  const { detection, detect, observe } = useKeyboardDetection(prefs, update);
  const [profileOpen, setProfileOpen] = useState(false);

  // ---- Texto: busca na API; o próximo já fica pré-carregado ----
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const prefetched = useRef(null);
  const fetchKey = `${prefs.lang}|${prefs.source}|${prefs.duration}`;

  const loadText = useCallback(async () => {
    const ready = prefetched.current;
    prefetched.current = null;
    if (ready?.key === fetchKey) {
      setPayload(await ready.promise);
    } else {
      setLoading(true);
      setPayload(await fetchText(prefs).catch(() => null));
      setLoading(false);
    }
    const promise = fetchText(prefs).catch(() => null);
    prefetched.current = { key: fetchKey, promise };
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadText(); }, [loadText]);

  const text = useMemo(() => (payload ? buildText(payload, prefs) : ""),
    [payload, prefs.accents, prefs.caps, prefs.punct, prefs.numbers, prefs.layout, prefs.form, prefs.avoidFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Teste ----
  const test = useTypingTest(text, prefs.duration, prefs.accents);
  const areaRef = useRef(null);
  const lastCode = useRef(null);
  const [flash, setFlash] = useState(null);

  const restart = useCallback(() => {
    test.reset();
    loadText();
    requestAnimationFrame(() => areaRef.current?.focus());
  }, [test.reset, loadText]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChar = useCallback((ch) => {
    const ok = test.typeChar(ch);
    if (ok !== null && lastCode.current) setFlash({ code: lastCode.current, ok, id: performance.now() });
  }, [test.typeChar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teclas em qualquer lugar da página: detectam o teclado e devolvem o foco ao texto.
  useEffect(() => {
    const onKey = (e) => {
      if (profileOpen) return;
      lastCode.current = e.code;
      observe(e);
      const tag = document.activeElement?.tagName;
      if (test.phase === "done") {
        if (e.key === "Tab") { e.preventDefault(); restart(); }
        return;
      }
      if (tag !== "INPUT" && !(tag === "BUTTON" && (e.key === "Enter" || e.key === " "))) {
        if (e.key === "Tab") { e.preventDefault(); restart(); return; }
        areaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [observe, profileOpen, restart, test.phase]);

  // Ao mudar uma opção, recomeça com o texto ajustado.
  useEffect(() => { test.reset(); areaRef.current?.focus(); },
    [prefs.accents, prefs.caps, prefs.punct, prefs.numbers, prefs.layout, prefs.form, prefs.avoidFn]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextKeys = useMemo(
    () => (test.phase === "done" ? [] : keysFor(text[test.typed.length], prefs.layout, prefs.accents)),
    [text, test.typed.length, test.phase, prefs.layout, prefs.accents]);

  const heat = useMemo(() => {
    if (!test.results) return null;
    const entries = test.results.errorsByChar;
    const max = entries[0]?.[1] || 1;
    const m = new Map();
    for (const [ch, n] of entries) {
      for (const { code } of keysFor(ch, prefs.layout, "strip")) {
        if (!SHIFTS.has(code)) m.set(code, Math.max(m.get(code) ?? 0, 0.25 + 0.75 * (n / max)));
      }
    }
    return m;
  }, [test.results, prefs.layout]);

  const applyProfile = (draft) => {
    const patch = { form: draft.form, avoidFn: draft.avoidFn, profileLocked: true };
    if (draft.layout !== prefs.layout) Object.assign(patch, { layout: draft.layout, accents: ACCENTS_FOR_LAYOUT[draft.layout] });
    update(patch);
    setProfileOpen(false);
  };

  const remaining = test.phase === "idle" ? prefs.duration : test.live.remaining;
  const source = payload?.source;

  return (
    <>
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 pb-2 pt-5">
        <div className="flex items-center gap-2.5 text-[1.35rem] font-bold tracking-wide">
          <svg viewBox="0 0 32 32" className="size-[30px] text-red" aria-hidden>
            <path d="M4 6h18l6 6v14H10l-6-6z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M11 12h8l3 3v5h-8l-3-3z" fill="currentColor" />
          </svg>
          PressKey
        </div>
        <button type="button" onClick={() => setProfileOpen(true)}
          title={detection.bigKeysSeen ? "Você usou F-keys, setas ou numérico: seu teclado parece maior que 60%." : "Trocar o perfil de teclado"}
          className="chamfer-sm flex items-center gap-2.5 bg-carbon py-2 pl-3.5 pr-4 text-sm font-medium text-steel hover:text-bone">
          <span className={`size-2 ${detection.bigKeysSeen ? "bg-[#ffb020] shadow-[0_0_8px_#ffb020]" : "bg-red shadow-[0_0_8px_var(--color-red)]"}`} />
          {LAYOUT_NAMES[prefs.layout]} {FORM_NAMES[prefs.form].split(" ")[0]}
        </button>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 pb-12 pt-2">
        <Controls prefs={prefs} update={update} />

        {test.phase !== "done" ? (
          <section>
            <div className="mb-3 flex items-baseline gap-6">
              <div className="min-w-[2.4ch] text-5xl font-bold leading-none text-red tabular-nums [text-shadow:0_0_24px_rgb(225_10_23/.45)] sm:text-[3.4rem]">
                {remaining}
              </div>
              <div className="flex gap-5 text-steel">
                <span><b className="font-semibold text-bone tabular-nums">{Math.round(test.live.wpm)}</b> ppm</span>
                <span><b className="font-semibold text-bone tabular-nums">{Math.round(test.live.accuracy)}</b>% precisão</span>
              </div>
              <button type="button" onClick={restart} title="Reiniciar (Tab)"
                className="ml-auto flex items-center gap-1.5 text-sm text-steel hover:text-bone">
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="max-sm:hidden">Reiniciar</span>
              </button>
            </div>

            {loading || !text ? (
              <div className="chamfer grid h-[260px] place-items-center bg-carbon text-steel">
                {loading ? "Buscando um trecho de livro…" : "Não foi possível carregar um texto. Tente Reiniciar."}
              </div>
            ) : (
              <TypingArea ref={areaRef} text={text} typed={test.typed} phase={test.phase} accents={prefs.accents}
                onChar={onChar} onBackspace={test.backspace} onRestart={restart} />
            )}

            <p className="mt-2.5 flex flex-wrap justify-between gap-2 text-sm text-steel">
              <span>O tempo começa na primeira tecla. <kbd>Tab</kbd> reinicia.</span>
              {source && (
                <span>
                  {source.kind === "local" ? "Texto offline do PressKey" : <>Trecho de <i className="text-bone">{source.title}</i>, {source.author}</>}
                  {payload?.fallbackReason && " (API indisponível)"}
                </span>
              )}
            </p>
          </section>
        ) : (
          <Results results={test.results} source={source} onAgain={restart} />
        )}

        <section className="mt-9" aria-label="Teclado virtual">
          <Keyboard layout={prefs.layout} next={nextKeys} heat={heat} flash={flash} />
          <p className="mt-3.5 text-center text-sm text-steel">
            {heat
              ? "Mapa de calor: quanto mais vermelho, mais erros naquela tecla."
              : `Layout ${LAYOUT_NAMES[prefs.layout]} (${FORM_NAMES[prefs.form]}). A tecla acesa é a próxima a digitar.`}
          </p>
        </section>
      </main>

      <ProfileDialog open={profileOpen} prefs={prefs} detection={detection}
        onClose={() => setProfileOpen(false)} onApply={applyProfile}
        onRedetect={() => { update({ profileLocked: false }); detect(); setProfileOpen(false); }} />
    </>
  );
}
