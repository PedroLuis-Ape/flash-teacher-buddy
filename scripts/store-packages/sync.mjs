import { readFile } from "node:fs/promises";
import path from "node:path";

const catalogPath = path.join(process.cwd(), "store-packages", "catalog-v1.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

console.log(`Catálogo carregado: ${catalog.packages.length} pacote(s).`);
console.log("A publicação é executada pelo gerenciador seguro do Supabase.");
