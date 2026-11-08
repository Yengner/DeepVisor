/** Bound whole rows, never truncate JSON, numeric values, or entity IDs. */
export function boundedToolOutput(value: unknown, maxBytes = 10000): string {
  const serialize = (data: unknown) => JSON.stringify(data);
  if (Buffer.byteLength(serialize(value), 'utf8') <= maxBytes) return serialize(value);
  if (Array.isArray(value)) {
    for (let count = value.length - 1; count >= 0; count--) {
      const output = serialize({ data: value.slice(0, count), truncated: true, availableRows: value.length, returnedRows: count });
      if (Buffer.byteLength(output, 'utf8') <= maxBytes) return output;
    }
  }
  if (value && typeof value === 'object') {
    const copy = { ...value } as Record<string, unknown>;
    copy.truncated = true;
    copy.coverageNote = 'Some whole rows omitted to fit the assistant context. Do not treat this as complete account history.';
    for (const [key, rows] of Object.entries(copy)) {
      if (!Array.isArray(rows)) continue;
      for (let count = rows.length - 1; count >= 0; count--) {
        copy[key] = rows.slice(0, count);
        const output = serialize(copy);
        if (Buffer.byteLength(output, 'utf8') <= maxBytes) return output;
      }
    }
  }
  throw new Error('This account lookup is too broad. Ask about a specific campaign.');
}
