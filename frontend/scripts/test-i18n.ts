// 일본어 사전 점검: 코드의 t("...")·msg("...") 문장이 모두 src/lib/i18n/ja/ 사전에 있는지,
// {이름} 자리 표시가 번역문에도 똑같이 있는지 확인한다. 실행: npm run test:i18n
// --todo 를 붙이면 t()로 감싸지 않은 한글 문자열 후보도 보여 준다 (주석·회원 글은 빼고 사람이 판단)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ja } from "../src/lib/i18n/ja";

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !p.includes(join("lib", "i18n", "ja"))) files.push(p);
  }
};
walk("src");

const CALL = /\b(?:t|msg)\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\$])*)`)/g;
const unescape = (s: string) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** 주석을 지운 코드 (줄 수는 그대로). 문자열 안의 // 는 남긴다 */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""))
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");

const missing = new Map<string, string>();
const keys = new Set<string>();
for (const f of files) {
  const src = stripComments(readFileSync(f, "utf8"));
  for (const m of src.matchAll(CALL)) {
    const key = unescape(m[1] ?? m[2] ?? m[3] ?? "");
    if (!/[가-힣]/.test(key)) continue;
    keys.add(key);
    if (!(key in ja) && !missing.has(key)) missing.set(key, f);
  }
}

const badHoles = Object.entries(ja).filter(([ko, jp]) => holes(ko) !== holes(jp));
const leftKorean = Object.entries(ja).filter(([, jp]) => /[가-힣]/.test(jp));

let failed = false;
if (missing.size) {
  failed = true;
  console.error(`✗ 일본어 사전에 없는 문장 ${missing.size}개:`);
  for (const [k, f] of missing) console.error(`  ${f}: ${JSON.stringify(k)}`);
}
if (badHoles.length) {
  failed = true;
  console.error(`✗ {자리 표시}가 다른 번역 ${badHoles.length}개:`);
  for (const [k, v] of badHoles) console.error(`  ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
}
if (leftKorean.length) {
  failed = true;
  console.error(`✗ 번역문에 한글이 남은 문장 ${leftKorean.length}개:`);
  for (const [k, v] of leftKorean) console.error(`  ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
}

if (process.argv.includes("--todo")) {
  // 주석을 빼고, t()/msg() 밖에 있는 한글 문자열·JSX 글자가 있는 줄
  for (const f of files) {
    stripComments(readFileSync(f, "utf8"))
      .split("\n")
      .forEach((line, i) => {
        const code = line.replace(CALL, "").replace(/\{\/\*.*?\*\/\}/g, "");
        if (/[가-힣]/.test(code)) console.log(`${f}:${i + 1}: ${line.trim()}`);
      });
  }
}

if (failed) process.exit(1);
console.log(`✓ i18n: 코드 문장 ${keys.size}개 모두 일본어 사전에 있음 (사전 ${Object.keys(ja).length}개)`);
