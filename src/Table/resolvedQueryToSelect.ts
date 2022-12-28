import { builder as b, Node } from 'zensqlite';
import { SchemaTableAny } from '../schemaOlfd/mod';
import { dedupe, isNotNull } from '../Utils';
import { createFrom, createLimit, createOrderBy } from './create';
import { createWhere } from './createWhere';
import { ResolvedJoin, ResolvedQuery } from './resolveQuery';
import { dotCol, ParamsMap } from './utils';

export function resolvedQueryToSelect(
  paramsMap: ParamsMap,
  table: SchemaTableAny,
  resolved: ResolvedQuery,
  join: { join: ResolvedJoin; query: ResolvedQuery; select: Node<'SelectStmt'> } | null
): Node<'SelectStmt'> {
  return b.SelectStmt({
    resultColumns: [
      ...dedupe([...(resolved.columns ?? []), ...resolved.joinColumns, ...resolved.primaryColumns]).map((col) =>
        b.ResultColumn.Expr(
          b.Column({ column: col, table: resolved.tableAlias }),
          b.Identifier(dotCol(resolved.tableAlias, col)) // alias to "table.col"
        )
      ),
      join ? b.ResultColumn.TableStar(join.query.tableAlias) : null,
    ].filter(isNotNull),
    from: createFrom(resolved, join),
    where: createWhere(paramsMap, table, resolved.where, resolved.tableAlias),
    limit: createLimit(resolved.limit, resolved.offset),
    orderBy: createOrderBy(resolved.orderBy, resolved.tableAlias),
  });
}
