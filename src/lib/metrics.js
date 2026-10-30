// Métricas do teste de digitação.
//
// Convenções (valem para todo o app):
// - Uma "palavra" = 5 caracteres. Espaços CONTAM como caracteres.
// - Cada tecla de caractere é um "caractere avaliado"; Backspace não é avaliado.
// - Um erro corrigido continua contando como erro (a precisão mede o que foi digitado,
//   não o texto final). Os erros que ficaram no texto são reportados à parte.
// - Todo tempo vem de performance.now() (relógio monotônico); nada depende de
//   contadores incrementados por setInterval.

/**
 * @typedef {{ t: number, ok: boolean, expected: string, typed: string }} Keystroke
 *   t = ms desde o início do teste (performance.now() - start)
 */

const WORD = 5;

export function computeLive(keystrokes, elapsedMs) {
  const minutes = Math.max(elapsedMs, 1) / 60000;
  const evaluated = keystrokes.length;
  const correct = keystrokes.reduce((n, k) => n + (k.ok ? 1 : 0), 0);
  return {
    wpm: correct / WORD / minutes,
    accuracy: evaluated ? (correct / evaluated) * 100 : 100,
  };
}

/**
 * @param {Keystroke[]} keystrokes
 * @param {number} elapsedMs   duração real medida com performance.now()
 * @param {number} finalCorrect caracteres corretos no texto final (após correções)
 * @param {number} finalWrong   caracteres errados que ficaram no texto final
 */
export function computeResults(keystrokes, elapsedMs, finalCorrect, finalWrong) {
  const seconds = Math.max(elapsedMs, 1) / 1000;
  const minutes = seconds / 60;
  const evaluated = keystrokes.length;
  const correctKeys = keystrokes.reduce((n, k) => n + (k.ok ? 1 : 0), 0);
  const errors = evaluated - correctKeys;

  const timeline = buildTimeline(keystrokes, seconds);

  return {
    seconds,
    wpm: finalCorrect / WORD / minutes,          // líquido: só o que ficou certo
    rawWpm: evaluated / WORD / minutes,          // bruto: tudo que foi digitado
    cpm: evaluated / minutes,
    accuracy: evaluated ? (correctKeys / evaluated) * 100 : 0,
    errors,                                      // teclas erradas (inclui corrigidas)
    uncorrected: finalWrong,                     // erros que ficaram no texto
    evaluated,
    correctKeys,
    consistency: consistency(timeline),
    timeline,
    errorsByChar: errorsByChar(keystrokes),
  };
}

// Agrupa as teclas em janelas de 1s pelo timestamp real de cada uma.
function buildTimeline(keystrokes, seconds) {
  const buckets = Math.max(1, Math.ceil(seconds - 1e-6));
  const rows = Array.from({ length: buckets }, (_, i) => ({
    second: i + 1,
    span: Math.min(1, seconds - i), // a última janela pode ser parcial
    typed: 0,
    errors: 0,
    cumulativeCorrect: 0,
  }));

  for (const k of keystrokes) {
    const row = rows[Math.min(buckets - 1, Math.floor(k.t / 1000))];
    row.typed++;
    if (!k.ok) row.errors++;
  }

  let correct = 0, typedSoFar = 0;
  for (const r of rows) {
    typedSoFar += r.typed;
    correct += r.typed - r.errors;
    const end = r.second - 1 + r.span;
    r.raw = (r.typed / WORD) * (60 / r.span);
    r.wpm = (correct / WORD) / (end / 60);
    r.cumulativeCorrect = correct;
  }
  return rows;
}

// 100 − coeficiente de variação (%) da velocidade bruta por segundo.
// Janelas parciais com menos de meio segundo são ignoradas para não distorcer.
function consistency(timeline) {
  const values = timeline.filter((r) => r.span >= 0.5).map((r) => r.raw);
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!mean) return 0;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return Math.max(0, 100 - (sd / mean) * 100);
}

function errorsByChar(keystrokes) {
  const out = {};
  for (const k of keystrokes) {
    if (k.ok) continue;
    const key = k.expected.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out[key] = (out[key] || 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}
