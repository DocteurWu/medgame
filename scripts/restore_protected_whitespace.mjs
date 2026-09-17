// Restaure a l'identique les chaines protegees dont la seule difference
// avec HEAD est un trim d'espaces (effet de bord de la 1re passe).
// Ne restaure JAMAIS une valeur contenant un emoji ou un tiret cadratin
// (contraintes fichier : zero emoji, zero cadratin).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const hasBanned = (s) => EMOJI_RE.test(s) || /[\u2014]/.test(s);

let restored = 0;
function walk(cur, old, pathStr, file) {
  if (typeof cur === "string" && typeof old === "string") {
    if (cur !== old && old.trim() === cur.trim() && !hasBanned(old)) {
      // Difference uniquement d'espaces en bordure -> restaurer l'original.
      return { value: old, changed: true };
    }
    return { value: cur, changed: false };
  }
  if (Array.isArray(cur) && Array.isArray(old)) {
    let ch = false;
    const arr = cur.map((v, i) => {
      if (i >= old.length) return v;
      const r = walk(v, old[i], `${pathStr}[${i}]`, file);
      if (r.changed) ch = true;
      return r.value;
    });
    return { value: arr, changed: ch };
  }
  if (cur && old && typeof cur === "object" && typeof old === "object") {
    let ch = false;
    for (const k of Object.keys(cur)) {
      if (k in old) {
        const r = walk(cur[k], old[k], `${pathStr}.${k}`, file);
        if (r.changed) { cur[k] = r.value; ch = true; restored++; console.log(`RESTORE ${file} :: ${pathStr}.${k}`); }
      }
    }
    return { value: cur, changed: ch };
  }
  return { value: cur, changed: false };
}

const dir = "data";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !["REFERENCE_ECOS_CANONICAL.json", "case-index.json", "patient_test_complet.json", "test_gating.json", "drugs.json"].includes(f));
for (const f of files) {
  const fp = path.join(dir, f);
  const old = JSON.parse(execSync(`git show HEAD:data/${f}`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }));
  const cur = JSON.parse(fs.readFileSync(fp, "utf8"));
  const r = walk(cur, old, "$", f);
  if (r.changed) fs.writeFileSync(fp, JSON.stringify(r.value, null, 2) + "\n", "utf8");
}
console.log(`Termine : ${restored} chaines restaurees a l'identique.`);
