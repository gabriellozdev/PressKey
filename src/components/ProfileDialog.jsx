import { useEffect, useRef, useState } from "react";
import { LAYOUT_NAMES } from "../lib/keyboard.js";

export default function ProfileDialog({ open, prefs, detection, onClose, onApply, onRedetect }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(prefs);

  useEffect(() => {
    if (open) { setDraft(prefs); ref.current?.showModal(); }
    else ref.current?.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const how = detection.source === "api"
    ? `O navegador informou um layout ${LAYOUT_NAMES[detection.layout]}.`
    : detection.source === "typing"
      ? "Ajustado pelo que você digitou (teclas mortas ou Ç)."
      : "Seu navegador não informa o layout; ele é ajustado enquanto você digita.";

  const field = "grid gap-1.5 text-sm text-steel";
  const select = "border border-edge bg-plate p-2.5 text-bone";

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}
      className="chamfer m-auto w-[min(460px,calc(100vw-32px))] bg-carbon p-0 text-bone backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <form method="dialog" className="grid gap-4 p-6" onSubmit={(e) => { e.preventDefault(); onApply(draft); }}>
        <h2 className="text-xl font-semibold">Perfil do teclado</h2>
        <p className="text-sm text-steel">
          {how}{detection.bigKeysSeen && " Você usou teclas que não existem num 60% sem Fn."} O formato físico
          (60%, TKL…) não é visível para o navegador, então escolha abaixo.
        </p>

        <label className={field}>Layout
          <select className={select} value={draft.layout} onChange={(e) => setDraft({ ...draft, layout: e.target.value })}>
            <option value="us">US (ANSI): sem acentos</option>
            <option value="us-intl">US Internacional: acentos com teclas mortas</option>
            <option value="abnt2">ABNT2: teclado brasileiro com Ç</option>
          </select>
        </label>

        <label className={field}>Formato
          <select className={select} value={draft.form} onChange={(e) => setDraft({ ...draft, form: e.target.value })}>
            <option value="60">60%: sem F1–F12, setas e numérico</option>
            <option value="65">65% / 75%</option>
            <option value="tkl">TKL / full size</option>
          </select>
        </label>

        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-1 accent-red" checked={draft.avoidFn}
            onChange={(e) => setDraft({ ...draft, avoidFn: e.target.checked })} />
          Evitar o <code className="font-mono text-ember">~</code>, que no 60% fica na camada Fn
        </label>

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onRedetect}
            className="border border-edge px-4 py-2.5 text-steel hover:border-steel hover:text-bone">
            Detectar de novo
          </button>
          <button type="submit" className="chamfer-sm bg-red px-6 py-2.5 font-semibold hover:bg-ember">Aplicar</button>
        </div>
      </form>
    </dialog>
  );
}
