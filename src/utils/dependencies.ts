import type {
  TTableQueryDependency,
  TTableQueryInternal,
} from "../Query.types.ts";
import { isStateEmpty } from "./isStateEmpty.ts";

export function appendDependencies(
  prevDeps: Array<TTableQueryDependency>,
  table: TTableQueryInternal<any, any>,
): Array<TTableQueryDependency> {
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

export function asTableDependency(
  table: TTableQueryInternal<any, any>,
): Array<TTableQueryDependency> {
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
  left: Array<TTableQueryDependency> | undefined,
  right: Array<TTableQueryDependency> | undefined,
): Array<TTableQueryDependency> {
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
