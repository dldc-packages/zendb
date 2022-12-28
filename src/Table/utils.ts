export type ParamsMap = Map<string, unknown>;

export function dotCol(table: string, col: string): string {
  return `${table}__${col}`;
}

export function paramsFromMap(paramsMap: ParamsMap): Record<string, any> | null {
  const entries = Array.from(paramsMap.entries());
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}
