import type { ITableQueryDependency, ITableQueryInternal } from '../TableQuery.types';
import { isStateEmpty } from './isStateEmpty';

export function appendDependencies(
  prevDeps: Array<ITableQueryDependency>,
  table: ITableQueryInternal<any, any>,
): Array<ITableQueryDependency> {
  if (isStateEmpty(table.state)) {
    if (table.dependencies.length === 0) {
      // No state and no dependencies, this is a base table, we can skip it
      return prevDeps;
    }
    // No state but has dependencies, we can just keep the dependencies
    return [...prevDeps, ...table.dependencies];
  }
  // Has state, we need to add it to the dependencies as well as all its dependencies
  return [...prevDeps, ...table.dependencies, table];
}

export function asTableDependency(table: ITableQueryInternal<any, any>): Array<ITableQueryDependency> {
  if (isStateEmpty(table.state)) {
    if (table.dependencies.length === 0) {
      // No state and no dependencies, this is a base table, we can skip it
      return [];
    }
    // No state but has dependencies, we can just keep the dependencies
    return [...table.dependencies];
  }
  return [...table.dependencies, table];
}

export function mergeDependencies(
  left: Array<ITableQueryDependency> | undefined,
  right: Array<ITableQueryDependency> | undefined,
): Array<ITableQueryDependency> {
  if (!left && !right) {
    return [];
  }
  if (!left) {
    return right!;
  }
  if (!right) {
    return left;
  }
  return [...left, ...right];
}
