import { Node, printNode } from 'zensqlite';
import { ISchemaAny, SchemaTableAny } from '../schemaOlfd/mod';
import { DatabaseTableQueryInternal, QueryParentBase, SelectionBase } from './builder';
import { groupRows } from './groupRows';
import { resolvedQueryToSelect } from './resolvedQueryToSelect';
import { resolveQuery } from './resolveQuery';
import { QueryResolved } from './types';
import { paramsFromMap } from './utils';

export function resolve<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
>(
  builder: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>
): QueryResolved<Schema, TableName, SchemaTable, Selection, Parent> {
  const schema = builder.schema;
  // map values to params names
  const paramsMap = new Map<any, string>();
  const [baseQuery, joins] = resolveQuery(schema, builder, null, 0);
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
    query: queryText,
    params,
    parseAll(data) {
      return groupRows(schema, baseQuery, joins, data);
    },
    parseOne(data) {
      const results = groupRows(schema, baseQuery, joins, data);
      if (results.length !== 1) {
        throw new Error(`Expected 1 result, got ${results.length}`);
      }
      return results[0];
    },
    parseMaybeOne(data) {
      const results = groupRows(schema, baseQuery, joins, data);
      if (results.length > 1) {
        throw new Error(`Expected maybe 1 result, got ${results.length}`);
      }
      return results[0] ?? null;
    },
    parseFirst(data) {
      const results = groupRows(schema, baseQuery, joins, data);
      if (results.length === 0) {
        throw new Error('Expected at least 1 result, got 0');
      }
      return results[0];
    },
    parseMaybeFirst(data) {
      const results = groupRows(schema, baseQuery, joins, data);
      return results[0] ?? null;
    },
  };
}
