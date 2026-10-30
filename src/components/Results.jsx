import { useEffect, useRef } from "react";

const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? "—" : n.toFixed(d));

function Stat({ label, value, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 bg-carbon px-3 py-2 first:chamfer-sm" title={hint}>
      <dt className="text-sm text-steel">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Chart({ timeline }) {
  const W = 800, H = 220, pad = 30;
  if (timeline.length < 2) {
    return <p className="grid h-[200px] place-items-center text-steel">Pouco tempo para gerar o gráfico</p>;
  }
  const max = Math.max(20, ...timeline.map((r) => Math.max(r.wpm, r.raw))) * 1.1;
  const x = (i) => pad + (i / (timeline.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const path = (k) => timeline.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full" role="img"
      aria-label="Velocidade por segundo">
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const v = Math.round(max * f);
        return (
          <g key={f}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="#26282e" />
            <text x={pad - 6} y={y(v) + 4} textAnchor="end" className="fill-[#5d6069] font-mono text-[11px]">{v}</text>
          </g>
        );
      })}
      <path d={`${path("wpm")} L${x(timeline.length - 1)},${H - pad} L${x(0)},${H - pad}Z`} fill="rgb(225 10 23 / .12)" />
      <path d={path("raw")} fill="none" stroke="var(--color-steel)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={path("wpm")} fill="none" stroke="var(--color-red)" strokeWidth="3" vectorEffect="non-scaling-stroke"
        style={{ filter: "drop-shadow(0 0 6px rgb(225 10 23 / .6))" }} />
      {timeline.map((r, i) => r.errors > 0 && (
        <path key={i} d={`M${x(i) - 4},${y(r.raw) - 12}l8,8m0,-8l-8,8`} stroke="var(--color-ember)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function Results({ results, source, onAgain }) {
  const againRef = useRef(null);
  useEffect(() => { againRef.current?.focus({ preventScroll: true }); }, []);
  const r = results;

  return (
    <section className="grid animate-rise gap-x-8 gap-y-5 md:grid-cols-[minmax(240px,1fr)_2fr]">
      <div className="md:row-span-2">
        <div className="text-[5rem] font-bold leading-[.9] text-red tabular-nums [text-shadow:0_0_40px_rgb(225_10_23/.5)] md:text-[7rem]">
          {fmt(r.wpm)}
        </div>
        <div className="mt-1.5 text-steel">palavras por minuto (líquido)</div>

        <dl className="mt-7 grid gap-0.5">
          <Stat label="Precisão" value={`${fmt(r.accuracy, 1)}%`} hint="Teclas certas ÷ teclas avaliadas × 100" />
          <Stat label="WPM bruto" value={fmt(r.rawWpm)} hint="Caracteres digitados ÷ 5 ÷ minutos" />
          <Stat label="CPM" value={fmt(r.cpm)} hint="Caracteres digitados ÷ minutos" />
          <Stat label="Erros" value={`${r.errors} (${r.uncorrected} sem corrigir)`} hint="Teclas erradas, incluindo as corrigidas com Backspace" />
          <Stat label="Consistência" value={r.consistency == null ? "—" : `${fmt(r.consistency)}%`} hint="100 − variação da velocidade a cada segundo" />
          <Stat label="Tempo" value={`${fmt(r.seconds, 1)}s`} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-steel">
          1 palavra = 5 caracteres, espaços incluídos. Erros corrigidos continuam contando na precisão.
          Tempo medido com relógio monotônico.
        </p>
      </div>

      <figure className="chamfer m-0 bg-carbon px-4 pb-2 pt-4">
        <figcaption className="flex flex-wrap justify-between gap-2 text-sm text-steel">
          Velocidade ao longo do teste
          <span className="flex items-center gap-1.5">
            <i className="ml-2 inline-block h-[3px] w-3.5 bg-red" />líquido
            <i className="ml-2 inline-block h-[3px] w-3.5 bg-steel" />bruto
            <i className="ml-2 inline-block size-2 rotate-45 bg-ember" />erros
          </span>
        </figcaption>
        <Chart timeline={r.timeline} />
      </figure>

      <div>
        <h2 className="mb-1.5 font-semibold">Teclas onde você mais errou</h2>
        <p className="leading-loose text-steel [word-spacing:4px]">
          {r.errorsByChar.length
            ? r.errorsByChar.slice(0, 6).map(([ch, n]) => (
                <span key={ch} className="mr-3"><kbd className="text-bone">{ch === " " ? "espaço" : ch}</kbd> {n}×</span>
              ))
            : "Nenhum erro. Limpo."}
        </p>
        {source?.url && (
          <p className="mt-3 text-sm text-steel">
            Texto: <a className="text-bone underline decoration-red underline-offset-4" href={source.url} target="_blank" rel="noreferrer">
              {source.title}</a>, {source.author}
          </p>
        )}
      </div>

      <button ref={againRef} type="button" onClick={onAgain}
        className="chamfer-sm justify-self-start bg-red px-7 py-3 font-semibold transition-colors hover:bg-ember md:col-span-2">
        Fazer outro teste
      </button>
    </section>
  );
}
