import { arrayToOptionalNonEmptyArray, builder as b, createNode, Node, SetItem } from 'zensqlite';
import { ISchemaTableAny } from '../SchemaTable';
import { PRIV } from '../Utils';
import { OrderDirection } from './builder';
import { getValueParam } from './getValueParam';
import { ResolvedJoin, ResolvedQuery } from './resolveQuery';
import { SelectFrom, SelectOrderBy } from './types';
import { dotCol, ParamsMap } from './utils';

export function createSetItems(paramsMap: ParamsMap, table: ISchemaTableAny, values: Record<string, any>): Array<SetItem> {
  return Object.entries(values).map(([col, value]) => {
    const column = table[PRIV].columns[col];
    if (!column) {
      throw new Error(`Column ${col} does not exist`);
    }
    return b.SetItems.ColumnName(col, getValueParam(paramsMap, column, col, value));
  });
}

export function createOrderBy(orderBy: null | Array<[string, OrderDirection]>, tableAlias: string): SelectOrderBy | undefined {
  if (orderBy === null) {
    return undefined;
  }
  return arrayToOptionalNonEmptyArray(
    orderBy.map(([col, dir]) => {
      return createNode('OrderingTerm', {
        expr: b.Column({ column: col, table: tableAlias }),
        direction: dir,
      });
    })
  );
}

export function createLimit(limit: number | null, offset: number | null): Node<'SelectStmt'>['limit'] | undefined {
  if (limit === null) {
    return undefined;
  }
  return {
    expr: b.literal(limit),
    offset: offset !== null ? { separator: 'Offset', expr: b.literal(offset) } : undefined,
  };
}

export function createFrom(
  resolved: ResolvedQuery,
  join: { join: ResolvedJoin; query: ResolvedQuery; select: Node<'SelectStmt'> } | null
): SelectFrom {
  return join
    ? b.From.Join(
        b.TableOrSubquery.Select(join.select, join.query.tableAlias),
        b.JoinOperator.Join('Left'),
        b.TableOrSubquery.Table(resolved.table, { alias: resolved.tableAlias }),
        b.JoinConstraint.On(
          b.Expr.Equal(
            b.Expr.Column(dotCol(join.query.tableAlias, join.join.currentCol)),
            b.Expr.Column(dotCol(resolved.tableAlias, join.join.joinCol))
          )
        )
      )
    : b.From.Table(resolved.table, { alias: resolved.tableAlias });
}
