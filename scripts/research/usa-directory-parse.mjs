import {createHash} from 'node:crypto';

// Reject malformed official rows rather than silently losing securities.
export function parseUSDirectory(raw, requiredFields) {
  if (typeof raw !== 'string' || !raw.trim()) throw Error('EMPTY_OFFICIAL_DIRECTORY');
  const lines = raw.trim().split(/\r?\n/);
  const header = lines.shift().split('|');
  if (new Set(header).size !== header.length) throw Error('DUPLICATE_DIRECTORY_HEADER');
  for (const field of requiredFields) if (!header.includes(field)) throw Error('MISSING_DIRECTORY_FIELD:' + field);
  const footer = lines.pop();
  if (!footer?.startsWith('File Creation Time:')) throw Error('MISSING_DIRECTORY_FOOTER');
  const sourceTimestamp = footer.slice('File Creation Time:'.length).split('|')[0].trim();
  if (!sourceTimestamp) throw Error('EMPTY_DIRECTORY_TIMESTAMP');
  const rows = lines.filter(Boolean).map((line, index) => {
    const values = line.split('|');
    if (values.length !== header.length) throw Error('MALFORMED_DIRECTORY_ROW:' + (index + 2));
    const row = Object.fromEntries(header.map((field, i) => [field, values[i]]));
    for (const field of requiredFields) if (!row[field]?.trim())
      throw Error('EMPTY_DIRECTORY_FIELD:' + field + ':' + (index + 2));
    for (const flag of ['ETF', 'Test Issue']) if (flag in row && !['Y', 'N'].includes(row[flag]))
      throw Error('INVALID_DIRECTORY_FLAG:' + flag + ':' + (index + 2));
    return row;
  });
  if (!rows.length) throw Error('EMPTY_DIRECTORY_ROWS');
  return {rows, sourceTimestamp, sha256: createHash('sha256').update(raw).digest('hex')};
}
