// Preparação do texto conforme o perfil de teclado e as opções escolhidas.

export const stripMarks = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

export function prepareText(raw, prefs) {
  let t = raw
    .replace(/[“”«»„]/g, '"').replace(/[‘’`´]/g, "'")
    .replace(/[—–]/g, "-").replace(/…/g, "...");

  if (prefs.accents === "strip") t = stripMarks(t);
  if (!prefs.caps) t = t.toLowerCase();
  if (!prefs.numbers) t = t.replace(/\d+/g, "");
  if (!prefs.punct) t = t.replace(/[.,;:!?"'()\[\]\-]/g, "");
  // No 60%, ` e ~ ficam na camada Fn (Fn+Esc). ` já virou ' acima.
  if (prefs.avoidFn && prefs.form === "60") t = t.replace(/~/g, "");
  // Sem tecla morta não há como digitar caracteres compostos.
  if (prefs.layout === "us" && prefs.accents === "keep") t = stripMarks(t);
  // Qualquer coisa fora do que um teclado comum digita é removida.
  t = t.replace(/[^\p{L}\p{N}\s.,;:!?"'()\-@#$%&*+=/]/gu, "");

  return t.replace(/\s+/g, " ").trim();
}

// Compara o caractere digitado com o esperado, respeitando o modo de acentos.
export function matches(typed, expected, accents) {
  if (typed === expected) return true;
  if (accents === "lenient" || accents === "strip") return stripMarks(typed) === stripMarks(expected);
  return false;
}

export async function fetchText(prefs) {
  // ~200 ppm de folga para a duração escolhida; parágrafos têm ~350 caracteres.
  const count = Math.min(12, Math.ceil((prefs.duration * 17) / 350) + 1);
  const source = prefs.lang === "pt" && prefs.source === "quotable" ? "gutenberg" : prefs.source;
  const res = await fetch(`/api/text?lang=${prefs.lang}&source=${source}&count=${count}`);
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  return res.json();
}

export function buildText(payload, prefs) {
  return payload.paragraphs
    .map((p) => prepareText(p, prefs))
    .filter(Boolean)
    .join(" ");
}
