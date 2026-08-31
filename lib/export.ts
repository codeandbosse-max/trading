function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Prevents spreadsheet formula injection on export.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map((c) => escapeCell(String(c))).join(';');
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(';'));
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
