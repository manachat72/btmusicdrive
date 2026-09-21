import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "C:/Users/may/Downloads/basic100176843export1788963592559_0909-22-19-52_เปลี่ยนรูปแล้ว.xlsx";
const catalogPath = "C:/Users/may/programpython/btmusicdrive/marketplace-images/catalog.json";

const norm = (s) => String(s ?? "")
  .toLowerCase()
  .replace(/[​﻿]/g, "")
  .replace(/&quot;/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, "");

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const A = bg(a);
  const B = bg(b);
  let inter = 0;
  for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g));
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return total ? (2 * inter) / total : 0;
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sheet = workbook.worksheets.getItem("template");
const titles = sheet.getRange("C5:C51").values.flat();
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8")).products;

const matches = titles.map((title, index) => {
  const ranked = catalog
    .map((p) => ({ code: p.code, title: p.title, score: similarity(norm(title), norm(p.title)), images: p.images }))
    .sort((a, b) => b.score - a.score);
  return {
    row: index + 5,
    sourceTitle: title,
    bestCode: ranked[0]?.code,
    bestTitle: ranked[0]?.title,
    score: Number((ranked[0]?.score ?? 0).toFixed(3)),
    secondCode: ranked[1]?.code,
    secondScore: Number((ranked[1]?.score ?? 0).toFixed(3)),
    margin: Number(((ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0)).toFixed(3)),
    images: ranked[0]?.images ?? [],
  };
});

const counts = new Map();
for (const match of matches) counts.set(match.bestCode, (counts.get(match.bestCode) ?? 0) + 1);
for (const match of matches) match.duplicateBestCode = counts.get(match.bestCode) > 1;

console.log(JSON.stringify(matches, null, 2));
