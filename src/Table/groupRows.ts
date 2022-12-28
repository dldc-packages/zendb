import { ISchemaAny, parseColumn } from '../schema';
import { arrayEqual } from '../Utils';
import { getColumnSchema } from './getColumnSchema';
import { ResolvedJoinItem, ResolvedQuery } from './resolveQuery';
import { transformJoin } from './transformJoin';
import { dotCol } from './utils';

export function groupRows(
  schema: ISchemaAny,
  query: ResolvedQuery,
  joins: Array<ResolvedJoinItem>,
  rows: Array<Record<string, unknown>>
): Array<any> {
  const colsKey = query.primaryColumns.map((col) => dotCol(query.tableAlias, col));
  const groups: Array<{ keys: Array<any>; rows: Array<Record<string, unknown>> }> = [];
  rows.forEach((row) => {
    const keys = colsKey.map((col) => row[col]);
    if (keys.includes(null)) {
      // if one of the primary key is null, the whole row is null (primary are non-nullable)
      return;
    }
    const group = groups.find((g) => arrayEqual(g.keys, keys));
    if (group) {
      group.rows.push(row);
    } else {
      groups.push({ keys, rows: [row] });
    }
  });
  const [join, ...nextJoins] = joins;
  return groups.map((group) => {
    const result: Record<string, any> = {};
    if (query.columns) {
      query.columns.forEach((col) => {
        const colSchema = getColumnSchema(schema, query.table, col);
        const rawValue = group.rows[0][dotCol(query.tableAlias, col)];
        result[col] = parseColumn(colSchema, rawValue);
      });
    }
    if (!join) {
      if (query.columns === null) {
        return undefined;
      }
      return result;
    }
    const joinName = join.query.table;
    const joinResult = groupRows(schema, join.query, nextJoins, group.rows);
    const joinContent = transformJoin(joinResult, join.join.kind);
    if (query.columns === null) {
      return joinContent;
    }
    if (joinContent !== undefined) {
      result[joinName] = joinContent;
    }
    return result;
  });
}
