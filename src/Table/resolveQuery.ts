import { ISchemaAny } from '../schemaOlfd/mod';
import { isNotNull, PRIV } from '../Utils';
import { DatabaseTableQueryInternalAny, JoinKind, OrderDirection } from './builder';

export type ResolvedQuery = {
  table: string;
  tableAlias: string;
  limit: null | number;
  offset: null | number;
  columns: Array<string> | null;
  joinColumns: Array<string>;
  primaryColumns: Array<string>;
  where: Record<string, unknown> | null;
  orderBy: null | Array<[string, OrderDirection]>;
};

export type ResolvedJoin = {
  kind: JoinKind;
  currentCol: string;
  joinCol: string;
};

export type ResolvedJoinItem = { query: ResolvedQuery; join: ResolvedJoin };

export type ResolvedJoins = [query: ResolvedQuery, joins: Array<ResolvedJoinItem>];

export function resolveQuery(
  schema: ISchemaAny,
  query: DatabaseTableQueryInternalAny,
  parentJoinCol: string | null,
  depth: number
): ResolvedJoins {
  const joinCol = query.parent?.joinCol ?? null;
  const table = schema.tables[query.table];
  const primaryColumns = Object.entries(table[PRIV].columns)
    .filter(([_, column]) => column[PRIV].primary)
    .map(([key]) => key);

  const resolved: ResolvedQuery = {
    table: query.table,
    tableAlias: `_${depth}`,
    columns: query.selection ? Object.keys(query.selection) : null,
    joinColumns: [joinCol, parentJoinCol].filter(isNotNull),
    primaryColumns,
    limit: query.take?.limit ?? null,
    offset: query.take?.offset ?? null,
    where: query.filter,
    orderBy: query.sort as any,
  };
  if (!query.parent) {
    return [resolved, []];
  }
  const [innerQuery, innerJoins] = resolveQuery(schema, query.parent.query, query.parent.currentCol, depth + 1);
  const join: ResolvedJoin = {
    currentCol: query.parent.currentCol,
    joinCol: query.parent.joinCol,
    kind: query.parent.kind,
  };
  return [innerQuery, [...innerJoins, { query: resolved, join }]];
}
