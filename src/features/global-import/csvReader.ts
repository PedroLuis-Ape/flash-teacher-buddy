export interface CsvRow {
  values: string[];
  line: number;
}

export class CsvReadError extends Error {
  constructor(message: string, line?: number) {
    super(line ? `Linha ${line}: ${message}` : message);
    this.name = "CsvReadError";
  }
}

export function readCsvRows(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let values: string[] = [];
  let value = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  const finishValue = () => {
    values.push(value);
    value = "";
  };
  const finishRow = () => {
    finishValue();
    if (values.some((item) => item.trim())) rows.push({ values, line: rowLine });
    values = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
        if (char === "\n") line += 1;
      }
    } else if (char === '"') {
      if (value) throw new CsvReadError("aspas inesperadas.", line);
      quoted = true;
    } else if (char === ",") {
      finishValue();
    } else if (char === "\n") {
      finishRow();
      line += 1;
      rowLine = line;
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (quoted) throw new CsvReadError("campo entre aspas não foi fechado.", rowLine);
  if (value || values.length) finishRow();
  return rows;
}
