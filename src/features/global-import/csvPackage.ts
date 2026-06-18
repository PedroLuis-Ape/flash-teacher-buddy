import { GLOBAL_IMPORT_CSV_COLUMNS, GLOBAL_IMPORT_CSV_SCHEMA } from "./csvContract";
import { CsvReadError, readCsvRows } from "./csvReader";
import { GLOBAL_IMPORT_SCHEMA, GLOBAL_IMPORT_VERSION, type GlobalImportPackage } from "./schema";
import { GLOBAL_IMPORT_LIMITS } from "./schema/globalImportSchema";

export interface CsvPackageResult {
  packageValue: GlobalImportPackage;
  notes: string[];
  rows: number;
  schema: typeof GLOBAL_IMPORT_CSV_SCHEMA;
}

function unwrapCsv(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:csv)?\s*([\s\S]*?)\s*```$/i);
  return { text: fenced ? fenced[1] : text, stripped: Boolean(fenced) };
}

export function parseGlobalImportCsv(raw: string): CsvPackageResult {
  const source = unwrapCsv(raw);
  const rows = readCsvRows(source.text);
  if (rows.length < 2) throw new CsvReadError("o CSV precisa de cabeçalho e pelo menos um flashcard.");

  const header = rows[0].values.map((value) => value.replace(/^\uFEFF/, "").trim());
  if (header.length !== 4 || header.some((value, index) => value !== GLOBAL_IMPORT_CSV_COLUMNS[index])) {
    throw new CsvReadError(`use exatamente o cabeçalho ${GLOBAL_IMPORT_CSV_COLUMNS.join(",")}.`, rows[0].line);
  }

  type Card = { front: string; back: string };
  type List = { name: string; cards: Card[] };
  type Folder = { name: string; lists: Map<string, List> };
  const folders = new Map<string, Folder>();
  const pairs = new Map<string, number>();

  for (const row of rows.slice(1)) {
    if (row.values.length !== 4) throw new CsvReadError(`esperadas 4 colunas; recebidas ${row.values.length}.`, row.line);
    const [folderName, listName, front, back] = row.values.map((value) => value.trim());
    if (!folderName || !listName || !front || !back) throw new CsvReadError("nenhum campo pode ficar vazio.", row.line);
    const pair = `${front.toLocaleLowerCase()}\u0000${back.toLocaleLowerCase()}`;
    const firstLine = pairs.get(pair);
    if (firstLine) throw new CsvReadError(`flashcard repetido; primeira ocorrência na linha ${firstLine}.`, row.line);
    pairs.set(pair, row.line);

    let folder = folders.get(folderName);
    if (!folder) {
      folder = { name: folderName, lists: new Map() };
      folders.set(folderName, folder);
    }
    let list = folder.lists.get(listName);
    if (!list) {
      list = { name: listName, cards: [] };
      folder.lists.set(listName, list);
    }
    list.cards.push({ front, back });
  }

  const listCount = [...folders.values()].reduce((total, folder) => total + folder.lists.size, 0);
  const cardCount = rows.length - 1;
  if (folders.size > GLOBAL_IMPORT_LIMITS.maxFolders) throw new CsvReadError(`limite de ${GLOBAL_IMPORT_LIMITS.maxFolders} pastas excedido.`);
  if (listCount > GLOBAL_IMPORT_LIMITS.maxLists) throw new CsvReadError(`limite de ${GLOBAL_IMPORT_LIMITS.maxLists} listas excedido.`);
  if (cardCount > GLOBAL_IMPORT_LIMITS.maxCards) throw new CsvReadError(`limite de ${GLOBAL_IMPORT_LIMITS.maxCards} flashcards excedido.`);

  const normalizedFolders = [...folders.values()].map((folder) => {
    const lists = [...folder.lists.values()].map((list) => ({
      name: list.name,
      expected_cards: list.cards.length,
      cards: list.cards,
    }));
    return {
      name: folder.name,
      expected_cards: lists.reduce((total, list) => total + list.cards.length, 0),
      lists,
    };
  });

  return {
    schema: GLOBAL_IMPORT_CSV_SCHEMA,
    rows: cardCount,
    notes: source.stripped ? ["O CSV foi extraído de um bloco Markdown."] : [],
    packageValue: {
      schema: GLOBAL_IMPORT_SCHEMA,
      version: GLOBAL_IMPORT_VERSION,
      package: { name: "Pacote CSV", folders: normalizedFolders },
    },
  };
}
