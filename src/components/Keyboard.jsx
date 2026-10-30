import { memo, useEffect, useRef } from "react";
import { LAYOUTS, layoutKey } from "../lib/keyboard.js";

/**
 * Teclado 60% desenhado na tela.
 * next: [{ code, dead? }] teclas a destacar · heat: Map(code → 0..1) para o mapa de calor
 * flash: { code, ok, id } última tecla pressionada
 */
function Keyboard({ layout, next = [], heat = null, flash = null }) {
  const boardRef = useRef(null);

  // O "flash" é imperativo para não re-renderizar o teclado inteiro a cada tecla.
  useEffect(() => {
    if (!flash) return;
    boardRef.current?.querySelectorAll(`[data-codes~="${flash.code}"]`).forEach((k) => {
      k.classList.remove("is-hit", "is-miss");
      void k.offsetWidth;
      k.classList.add(flash.ok ? "is-hit" : "is-miss");
    });
  }, [flash]);

  const nextCodes = new Map(next.map((k) => [k.code, k.dead]));

  return (
    <div ref={boardRef}
      className={`board chamfer relative mx-auto grid w-fit gap-1 bg-gradient-to-b from-[#17181c] to-[#0c0c0e] p-3.5
        after:absolute after:inset-x-[10%] after:bottom-0 after:h-0.5 after:bg-red after:shadow-[0_0_18px_4px_rgb(225_10_23/.55)]
        ${heat ? "is-heatmap" : ""}`}>
      {LAYOUTS[layoutKey(layout)].map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map(([codes, label, shifted, w], i) => {
            const list = [].concat(codes);
            const isLetter = /^Key[A-Z]$/.test(list[0]);
            const isMod = label.length > 1 || !label;
            const dead = list.map((c) => nextCodes.get(c)).find((v) => v !== undefined);
            const lit = list.some((c) => nextCodes.has(c));
            const h = heat ? Math.max(...list.map((c) => heat.get(c) ?? 0)) : 0;
            return (
              <div key={i} data-codes={list.join(" ")}
                style={{ "--w": w, ...(h ? { "--heat": h } : {}) }}
                className={`key flex flex-col items-center justify-center leading-tight select-none
                  ${isMod ? "is-mod" : ""} ${lit ? (dead ? "is-next-dead" : "is-next") : ""}`}>
                {isLetter ? <span>{shifted}</span> : (
                  <>
                    {shifted && <span className="text-[.72em] opacity-55">{shifted}</span>}
                    <span>{label}</span>
                  </>
                )}
                {(list[0] === "KeyF" || list[0] === "KeyJ") && <span className="mt-0.5 h-0.5 w-2.5 bg-[#4a4d55]" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default memo(Keyboard);
