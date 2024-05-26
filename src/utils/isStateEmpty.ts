import type { ITableQueryState } from "../Query.types.ts";

export function isStateEmpty(state: ITableQueryState): boolean {
  return Object.values(state).every((v) => v === undefined);
}
