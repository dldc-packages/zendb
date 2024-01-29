import type { ITableQueryState } from '../TableQuery.types';

export function isStateEmpty(state: ITableQueryState): boolean {
  return Object.values(state).every((v) => v === undefined);
}
