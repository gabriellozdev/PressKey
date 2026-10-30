import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { matches } from "../lib/text.js";

// Uma palavra só re-renderiza quando o próprio estado muda (strings primitivas no memo).
const Word = memo(function Word({ chars, start, status, wrong, active }) {
  return (
    <span className="word">
      {chars.map((ch, j) => {
        const s = status[j];
        const cls = ["letter",
          s === "o" && "is-ok", s === "x" && "is-bad", ch === " " && "is-space",
          active === j && "is-active"].filter(Boolean).join(" ");
        return (
          <span key={j} data-i={start + j} className={cls}>
            {ch === " " ? " " : ch}
            {s === "x" && <span className="wrong-typed" aria-hidden>{wrong[j] === " " ? "␣" : wrong[j]}</span>}
          </span>
        );
      })}
    </span>
  );
});

const TypingArea = forwardRef(function TypingArea(
  { text, typed, phase, accents, onChar, onBackspace, onRestart }, ref) {
  const inputRef = useRef(null);
  const linesRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [shift, setShift] = useState(0);
  const composing = useRef(false);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus({ preventScroll: true }) }));

  const words = useMemo(() => {
    const out = [];
    let start = 0;
    for (const w of text.match(/\S+\s?|\s/g) ?? []) {
      out.push({ chars: [...w], start });
      start += w.length;
    }
    return out;
  }, [text]);

  const cursor = typed.length;

  // Rolagem por linha: a linha atual fica sempre na 2ª posição visível.
  useLayoutEffect(() => {
    const el = linesRef.current?.querySelector(`[data-i="${cursor}"]`);
    if (!el) return;
    const style = getComputedStyle(el);
    const margin = parseFloat(style.marginTop);
    const pitch = el.offsetHeight + margin + parseFloat(style.marginBottom);
    setShift(Math.max(0, Math.round((el.offsetTop - margin - pitch) / pitch)) * pitch);
  }, [cursor, text]);

  const handleKeyDown = (e) => {
    if (e.key === "Tab") { e.preventDefault(); onRestart(); return; }
    if (e.key === "Backspace") { e.preventDefault(); onBackspace(e.ctrlKey || e.altKey); }
  };

  // Caracteres chegam pelo evento de input: assim teclas mortas (´ + a = á)
  // e IME compõem corretamente, como no input escondido do typing.com.
  const handleInput = (e) => {
    if (composing.current) return;
    const value = e.target.value;
    e.target.value = "";
    for (const ch of value) onChar(ch);
  };

  return (
    <div className="relative" onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
      <input
        ref={inputRef}
        className="absolute opacity-0 w-px h-px pointer-events-none"
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
        aria-label="Digite o texto"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(e) => { composing.current = false; handleInput(e); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      <div className={`chamfer relative bg-gradient-to-b from-carbon to-[#0b0b0d] px-5 py-4 sm:px-8 sm:py-6 cursor-text
        before:absolute before:inset-x-3.5 before:top-0 before:h-0.5 before:transition-all
        ${focused ? "before:bg-red before:shadow-[0_0_12px_var(--color-red)]" : "before:bg-steel/30"}`}>
        <div className={`typing ${phase === "idle" ? "is-idle" : ""}`}>
          <div ref={linesRef} className="typing-lines" style={{ transform: `translateY(${-shift}px)` }}>
            {words.map(({ chars, start }) => {
              let status = "", wrong = "";
              for (let j = 0; j < chars.length; j++) {
                const i = start + j;
                if (i >= cursor) { status += "p"; wrong += " "; continue; }
                const ok = matches(typed[i], text[i], accents);
                status += ok ? "o" : "x";
                wrong += typed[i];
              }
              const active = cursor >= start && cursor < start + chars.length ? cursor - start : -1;
              return <Word key={start} chars={chars} start={start} status={status} wrong={wrong} active={active} />;
            })}
          </div>
        </div>

        {!focused && phase !== "done" && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-[3px] text-bone font-medium">
            Clique aqui ou aperte qualquer tecla para focar
          </div>
        )}
      </div>
    </div>
  );
});

export default TypingArea;
