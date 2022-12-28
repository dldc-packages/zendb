import { JoinKind } from '../QueryBuilder';

export function transformJoin(results: Array<any>, kind: JoinKind): any {
  if (kind === 'many') {
    return results;
  }
  if (kind === 'maybeFirst') {
    return results[0] ?? null;
  }
  if (kind === 'first') {
    if (results.length === 0) {
      throw new Error('No result for a single join');
    }
    return results[0];
  }
  if (results.length > 1) {
    throw new Error('Multiple results for a single join');
  }
  if (kind === 'maybeOne') {
    return results[0] ?? null;
  }
  if (kind === 'one') {
    if (results.length === 0) {
      throw new Error('No result for a single join');
    }
    return results[0];
  }
  return expectNever(kind);
}
