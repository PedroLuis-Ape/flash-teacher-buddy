#!/usr/bin/env node
/**
 * Paridade dos catálogos de interface (pt-BR, en, es, fr, it).
 *
 * Detecta:
 * - chave ausente em algum idioma;
 * - chave presente somente em um idioma (extra suspeita);
 * - interpolação incompatível ({{var}} diferente entre idiomas);
 * - pluralização incompleta (_one sem _other e vice-versa).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const resourcesDir = resolve(root, 'src/i18n/resources');
const BASE = 'pt-BR';
const LOCALES = ['pt-BR', 'en', 'es', 'fr', 'it'];

function flatten(value, prefix = '', out = {}) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, path, out);
    else out[path] = item;
  }
  return out;
}

function loadLocale(locale) {
  const dir = join(resourcesDir, locale);
  const merged = {};
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    Object.assign(merged, JSON.parse(readFileSync(join(dir, file), 'utf8')));
  }
  return flatten(merged);
}

const interpolations = (value) =>
  typeof value === 'string'
    ? [...value.matchAll(/{{\s*([A-Za-z0-9_]+)\s*}}/g)].map((m) => m[1]).sort()
    : [];

const catalogs = Object.fromEntries(LOCALES.map((locale) => [locale, loadLocale(locale)]));
const problems = [];

const baseKeys = Object.keys(catalogs[BASE]);
for (const locale of LOCALES) {
  if (locale === BASE) continue;
  const keys = catalogs[locale];
  for (const key of baseKeys) {
    if (!(key in keys)) {
      problems.push(`MISSING  ${locale}: ${key}`);
      continue;
    }
    const expected = interpolations(catalogs[BASE][key]).join(',');
    const actual = interpolations(keys[key]).join(',');
    if (expected !== actual) {
      problems.push(`INTERPOLATION ${locale}: ${key} (${BASE}=[${expected}] ${locale}=[${actual}])`);
    }
    if (typeof keys[key] === 'string' && keys[key].trim() === '') {
      problems.push(`EMPTY    ${locale}: ${key}`);
    }
  }
  for (const key of Object.keys(keys)) {
    if (!(key in catalogs[BASE])) problems.push(`EXTRA    ${locale}: ${key}`);
  }
}

for (const locale of LOCALES) {
  for (const key of Object.keys(catalogs[locale])) {
    if (key.endsWith('_one') && !(`${key.slice(0, -4)}_other` in catalogs[locale])) {
      problems.push(`PLURAL   ${locale}: ${key} sem _other`);
    }
    if (key.endsWith('_other') && !(`${key.slice(0, -6)}_one` in catalogs[locale])) {
      problems.push(`PLURAL   ${locale}: ${key} sem _one`);
    }
  }
}

console.log(`i18n:validate — ${LOCALES.length} idiomas, ${baseKeys.length} chaves base`);
if (problems.length) {
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\n${problems.length} problema(s) de paridade encontrados.`);
  process.exit(1);
}
console.log('Paridade OK.');
