// API do PressKey: busca textos no Project Gutenberg (via Gutendex) ou no Quotable
// e devolve parágrafos prontos para digitar. Sem rede, usa os textos locais.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FALLBACK } from "./fallback-texts.js";

const PORT = process.env.PORT || 3001;
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Project Gutenberg
// ---------------------------------------------------------------------------
const GUTENDEX = "https://gutendex.com/books/";
const LANGS = { pt: "pt", en: "en" };
// Obras de referência não servem para digitar prosa.
const SKIP_TITLE = /dicion|biblia|bíblia|gramm|vocabul|index|catalog|dictionary|bible|encyclop|manual|tables/i;

const catalog = new Map(); // lang -> [{ id, title, author, txt }]
const books = new Map();   // id -> paragraphs[] (cache em memória)

async function fetchJson(url, ms = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return res.json();
}

async function getCatalog(lang) {
  if (catalog.has(lang)) return catalog.get(lang);
  // Filtrar por mime_type no Gutendex leva ~50s; filtramos os formatos aqui.
  const data = await fetchJson(`${GUTENDEX}?languages=${LANGS[lang]}`, 45000);
  const list = data.results
    .filter((b) => !SKIP_TITLE.test(b.title))
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.authors[0]?.name ?? "Autor desconhecido",
      txt: b.formats["text/plain; charset=utf-8"] || b.formats["text/plain"] || b.formats["text/plain; charset=us-ascii"],
    }))
    .filter((b) => b.txt);
  catalog.set(lang, list);
  return list;
}

// Extrai parágrafos de prosa "digitáveis" do .txt do Gutenberg.
function extractParagraphs(raw) {
  const start = raw.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end = raw.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  const body = raw.slice(start > 0 ? raw.indexOf("\n", start) : 0, end > 0 ? end : undefined);

  // Poesia tem linhas curtas dentro do bloco; prosa quebra perto de 70 colunas.
  const isProse = (block) => {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    return lines.length < 3 || lines.slice(0, -1).reduce((a, l) => a + l.trim().length, 0) / (lines.length - 1) > 58;
  };

  return body
    .split(/\r?\n\s*\r?\n/)
    .filter(isProse)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").replace(/_/g, "").replace(/\s*--\s*/g, " - ").replace(/\s+/g, " ").trim())
    .filter((p) =>
      p.length >= 160 && p.length <= 650 &&
      !/[\[\]{}<>|#*=]/.test(p) &&                 // notas, tabelas, marcações
      !/^[A-Z0-9 .,:;'"-]+$/.test(p) &&           // títulos em caixa alta
      /[.!?]["'”»]?$/.test(p) &&                  // termina em frase completa
      (p.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0) / p.length > 0.75);
}

async function getBook(book) {
  if (books.has(book.id)) return books.get(book.id);
  const res = await fetch(book.txt, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`Gutenberg respondeu ${res.status}`);
  const paragraphs = extractParagraphs(await res.text());
  if (books.size > 20) books.delete(books.keys().next().value);
  books.set(book.id, paragraphs);
  return paragraphs;
}

async function fromGutenberg(lang, count) {
  const list = await getCatalog(lang);
  // Tenta alguns livros até achar um com prosa suficiente.
  for (let attempt = 0; attempt < 4; attempt++) {
    const book = list[Math.floor(Math.random() * list.length)];
    const paragraphs = await getBook(book);
    if (paragraphs.length < count) continue;
    const from = Math.floor(Math.random() * (paragraphs.length - count));
    return {
      paragraphs: paragraphs.slice(from, from + count),
      source: { kind: "gutenberg", title: book.title, author: book.author, url: `https://www.gutenberg.org/ebooks/${book.id}` },
    };
  }
  throw new Error("Nenhum livro com parágrafos suficientes");
}

// ---------------------------------------------------------------------------
// Quotable (apenas inglês)
// ---------------------------------------------------------------------------
async function fromQuotable(count) {
  const quotes = await fetchJson(`https://api.quotable.io/quotes/random?limit=${count * 3}&minLength=90`, 8000);
  return {
    paragraphs: quotes.map((q) => q.content),
    source: { kind: "quotable", title: "Citações", author: "Quotable", url: "https://github.com/lukePeavey/quotable" },
  };
}

function fromLocal(lang, count) {
  const pool = [...FALLBACK[lang]].sort(() => Math.random() - 0.5);
  return {
    paragraphs: pool.slice(0, count),
    source: { kind: "local", title: "Textos do PressKey", author: "PressKey", url: null },
  };
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
app.get("/api/text", async (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "pt";
  const wanted = ["gutenberg", "quotable", "local"].includes(req.query.source) ? req.query.source : "gutenberg";
  const count = Math.min(12, Math.max(1, Number(req.query.count) || 6));

  const attempts = [];
  if (wanted === "quotable" && lang === "en") attempts.push(() => fromQuotable(count));
  if (wanted !== "local") attempts.push(() => fromGutenberg(lang, count));

  const failures = [];
  for (const attempt of attempts) {
    try {
      return res.json(await attempt());
    } catch (err) {
      failures.push(err.message);
      console.warn("[texto]", err.message);
    }
  }
  res.json({ ...fromLocal(lang, count), fallbackReason: failures.join("; ") || null });
});

// Em produção (npm run build && npm start) o Node também serve o front.
// Em desenvolvimento (npm run dev) não há dist/: o front roda no Vite, na porta 5173.
const dist = path.join(root, "..", "dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  app.get(/^(?!\/api).*/, (_req, res) =>
    res.status(404).type("text/plain; charset=utf-8")
      .send("Esta porta é só a API. Abra o site em http://localhost:5173 (npm run dev) ou rode npm run build antes de npm start."));
}

app.listen(PORT, () => {
  console.log(`PressKey API em http://localhost:${PORT}`);
  // O Gutendex é lento na primeira consulta; aquece o catálogo em segundo plano.
  for (const lang of Object.keys(LANGS)) getCatalog(lang).catch((e) => console.warn("[catálogo]", lang, e.message));
});
