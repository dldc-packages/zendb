import type { TTableQueryState } from "../Query.types.ts";

export function isStateEmpty(state: TTableQueryState): boolean {
  return Object.values(state).every((v) => v === undefined);
}
