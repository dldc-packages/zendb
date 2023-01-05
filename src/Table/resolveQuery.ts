import { ISchemaAny } from '../Schema';
import { TablesNames } from '../types';
import { isNotNull, PRIV } from '../Utils';
import { DatabaseTableQueryInternal, JoinKind, OrderDirection, QueryParentBase, SelectionBase } from './queryBuilder';
import { getSchemaTable } from './utils';

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

export function resolveQuery<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
>(
  schema: Schema,
  query: DatabaseTableQueryInternal<Schema, TableName, Selection, Parent>,
  parentJoinCol: string | null,
  depth: number
): ResolvedJoins {
  const joinCol = query.parent?.joinCol ?? null;
  const tableSchema = getSchemaTable(schema, query.table);
  const primaryColumns = Object.entries(tableSchema[PRIV].columns)
    .filter(([_, column]) => column[PRIV].primary)
    .map(([key]) => key);

  const resolved: ResolvedQuery = {
    table: query.table as string,
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
