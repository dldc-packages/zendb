import { Node, printNode } from 'zensqlite';
import { ISchemaAny } from '../Schema';
import { ISchemaTableAny } from '../SchemaTable';
import { DatabaseTableQueryInternal, QueryParentBase, SelectionBase } from './builder';
import { resolvedQueryToSelect } from './resolvedQueryToSelect';
import { ResolvedJoins, resolveQuery } from './resolveQuery';
import { paramsFromMap } from './utils';

export interface ResolveResult {
  schema: ISchemaAny;
  sql: string;
  params: Record<string, any> | null;
  resolvedJoins: ResolvedJoins;
}

export function resolve<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
>(builder: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>): ResolveResult {
  const schema = builder.schema;
  // map values to params names
  const paramsMap = new Map<any, string>();
  const resolvedJoins = resolveQuery(schema, builder, null, 0);
  const [baseQuery, joins] = resolvedJoins;
  const tables = builder.schema.tables;
  let prevQuery = baseQuery;
  let queryNode: Node<'SelectStmt'> = resolvedQueryToSelect(paramsMap, tables[baseQuery.table], baseQuery, null);
  joins.forEach(({ join, query }) => {
    queryNode = resolvedQueryToSelect(paramsMap, tables[query.table], query, {
      join,
      query: prevQuery,
      select: queryNode,
    });
    prevQuery = query;
  });
  const queryText = printNode(queryNode);
  const params = paramsFromMap(paramsMap);
  return {
    sql: queryText,
    params,
    schema,
    resolvedJoins,
  };
}
