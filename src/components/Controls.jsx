// Barra de opções do teste.
function Group({ name, children }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={name}>
      <span className="mr-2 text-sm text-steel">{name}</span>
      {children}
    </div>
  );
}

function Option({ active, disabled, title, onClick, children }) {
  return (
    <button type="button" aria-pressed={active} disabled={disabled} title={title}
      onClick={(e) => { onClick(); e.currentTarget.blur(); }}
      className={`px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30
        ${active ? "bg-blood text-bone shadow-[inset_0_-2px_0_var(--color-red)]" : "text-steel hover:text-bone"}`}>
      {children}
    </button>
  );
}

export default function Controls({ prefs, update }) {
  const radio = (key, options) => options.map(([value, label, extra = {}]) => (
    <Option key={value} active={prefs[key] === value} onClick={() => update({ [key]: value })} {...extra}>{label}</Option>
  ));

  return (
    <section className="flex flex-wrap gap-x-7 gap-y-2 pb-5" aria-label="Configurações do teste">
      <Group name="Tempo">
        {radio("duration", [[15, "15s"], [30, "30s"], [60, "60s"], [120, "2min"]])}
      </Group>
      <Group name="Acentos">
        {radio("accents", [
          ["strip", "Sem", { title: "Remove todos os acentos e o ç do texto" }],
          ["lenient", "Tolerante", { title: "Mostra acentos, mas aceita a letra sem acento" }],
          ["keep", "Exigir", {
            disabled: prefs.layout === "us",
            title: prefs.layout === "us" ? "Seu layout US não tem teclas mortas para acentuar" : "Exige digitar os acentos",
          }],
        ])}
      </Group>
      <Group name="Texto">
        {[["caps", "Aa"], ["punct", ".,!?"], ["numbers", "123"]].map(([key, label]) => (
          <Option key={key} active={prefs[key]} onClick={() => update({ [key]: !prefs[key] })}>{label}</Option>
        ))}
      </Group>
      <Group name="Idioma">
        {radio("lang", [["pt", "PT"], ["en", "EN"]])}
      </Group>
      <Group name="Fonte">
        {radio("source", [
          ["gutenberg", "Livros", { title: "Trechos de livros do Project Gutenberg" }],
          ["quotable", "Citações", {
            disabled: prefs.lang === "pt",
            title: prefs.lang === "pt" ? "O Quotable só tem citações em inglês" : "Citações do Quotable",
          }],
          ["local", "Offline", { title: "Textos embutidos no PressKey" }],
        ])}
      </Group>
    </section>
  );
}
