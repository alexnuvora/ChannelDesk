export type ImportedCaption = {caption: string; row: number};
export function parseDraftCsv(input: string): ImportedCaption[] {
  if (new TextEncoder().encode(input).length > 256 * 1024) throw new Error('Choose a CSV file smaller than 256 KB.');
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];let row: string[] = [], cell = '', quoted = false, afterQuote = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {cell += '"';i++;}
      else if (c === '"') {quoted = false;afterQuote = true;}
      else cell += c;
    } else if (c === '"') {
      if (cell || afterQuote) throw new Error('Invalid CSV quoting. Export as standard comma-separated CSV.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell);cell = '';afterQuote = false;
      if (c !== ',') {rows.push(row);row = [];if (c === '\r' && source[i + 1] === '\n') i++;}
    } else {
      if (afterQuote) throw new Error('Unexpected text after a quoted CSV value.');
      cell += c;
    }
  }
  if (quoted) throw new Error('A quoted caption is not closed.');
  if (cell || row.length || afterQuote) {row.push(cell);rows.push(row);}
  const headers = (rows.shift() || []).map(h => h.trim().toLowerCase());
  const index = headers.indexOf('caption');
  if (index < 0 || headers.filter(h => h === 'caption').length !== 1) throw new Error('Include exactly one column named caption.');
  if (headers.some(h => ['scheduled_for', 'scheduled time (utc)', 'date', 'time'].includes(h))) throw new Error('This importer saves unscheduled drafts. Remove scheduling columns before importing.');
  const result: ImportedCaption[] = [];
  for (const [i, values] of rows.entries()) {
    if (values.every(v => !v.trim())) continue;
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2} has the wrong number of columns.`);
    const caption = values[index].trim();
    if (!caption || caption.length > 2200) throw new Error(`Row ${i + 2}: captions must contain 1–2,200 characters.`);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(caption)) throw new Error(`Row ${i + 2} contains unsupported control characters.`);
    result.push({caption, row: i + 2});
  }
  if (!result.length || result.length > 100) throw new Error('Import between 1 and 100 captions at a time.');
  return result;
}
