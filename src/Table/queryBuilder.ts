import { Expr } from '../Expr';
import { IQueryOperation } from '../Operation';
import { ISchemaAny } from '../Schema';
import { SchemaColumnOutputValue } from '../SchemaColumn';
import { ExtractTable, TablesNames } from '../types';
import { PRIV } from '../Utils';
import { groupRows } from './groupRows';
import { resolve } from './resolve';
import { Result } from './types';

export type JoinKind = 'many' | 'one' | 'maybeOne' | 'first' | 'maybeFirst';

type QueryParent<
  Schema extends ISchemaAny,
  Kind extends JoinKind,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> = {
  kind: Kind;
  currentCol: string;
  joinCol: string;
  query: DatabaseTableQueryInternal<Schema, TableName, Selection, Parent>;
};

export type QueryParentBase<Schema extends ISchemaAny> = QueryParent<
  Schema,
  JoinKind,
  keyof Schema['tables'],
  SelectionBase<Schema, keyof Schema['tables']> | null,
  any
>;

export type OrderDirection = 'Asc' | 'Desc';

export type OrderingTerm<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = [
  ExtractColumnsNames<Schema, TableName>,
  OrderDirection
];

export type ExtractColumnsNames<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = keyof ExtractTable<
  Schema,
  TableName
>[PRIV]['columns'];

export type SelectionBase<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = {
  [K in ExtractColumnsNames<Schema, TableName>]?: true;
};

export type WhereBase<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = {
  [K in ExtractColumnsNames<Schema, TableName>]?:
    | SchemaColumnOutputValue<ExtractTable<Schema, TableName>[PRIV]['columns'][K]>
    | Expr<SchemaColumnOutputValue<ExtractTable<Schema, TableName>[PRIV]['columns'][K]>>;
};

/**
 * Internal state of a DatabaseTableQuery
 */
export type DatabaseTableQueryInternal<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> = Readonly<{
  schema: Schema;
  table: TableName;
  selection: Selection;
  filter: WhereBase<Schema, TableName> | null;
  take: null | { limit: number | null; offset: number | null };
  sort: null | Array<OrderingTerm<Schema, TableName>>;
  parent: Parent;
}>;

export interface IQueryBuilder<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> {
  readonly [PRIV]: DatabaseTableQueryInternal<Schema, TableName, Selection, Parent>;

  select<Selection extends SelectionBase<Schema, TableName>>(selection: Selection): IQueryBuilder<Schema, TableName, Selection, Parent>;

  filter(condition: WhereBase<Schema, TableName>): IQueryBuilder<Schema, TableName, Selection, Parent>;

  take(limit: number | null, offset?: number | null): IQueryBuilder<Schema, TableName, Selection, Parent>;

  sort(column: ExtractColumnsNames<Schema, TableName>, direction?: OrderDirection): IQueryBuilder<Schema, TableName, Selection, Parent>;
  sort(
    arg1: OrderingTerm<Schema, TableName>,
    ...others: Array<OrderingTerm<Schema, TableName>>
  ): IQueryBuilder<Schema, TableName, Selection, Parent>;

  join<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'many', TableName, Selection, Parent>>;

  joinOne<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'one', TableName, Selection, Parent>>;

  joinMaybeOne<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'maybeOne', TableName, Selection, Parent>>;

  joinFirst<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'first', TableName, Selection, Parent>>;

  joinMaybeFirst<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'maybeFirst', TableName, Selection, Parent>>;

  // Returns an Array
  all(): IQueryOperation<Array<Result<Schema, TableName, Selection, Parent>>>;
  // Throw if result count is not === 1
  one(): IQueryOperation<Result<Schema, TableName, Selection, Parent>>;
  // Throw if result count is > 1
  maybeOne(): IQueryOperation<Result<Schema, TableName, Selection, Parent> | null>;
  // Throw if result count is === 0
  first(): IQueryOperation<Result<Schema, TableName, Selection, Parent>>;
  // Never throws
  maybeFirst(): IQueryOperation<Result<Schema, TableName, Selection, Parent> | null>;
}

export type IQueryBuilderAny = IQueryBuilder<ISchemaAny, any, any, any>;

export function queryBuilder<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
  schema: Schema,
  table: TableName
): IQueryBuilder<Schema, TableName, null, null> {
  return createQueryBuilder({ schema, table, selection: null, filter: null, take: null, parent: null, sort: null });
}

function createQueryBuilder<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
>(internal: DatabaseTableQueryInternal<Schema, TableName, Selection, Parent>): IQueryBuilder<Schema, TableName, Selection, Parent> {
  return {
    [PRIV]: internal,
    select(selection) {
      return createQueryBuilder({ ...internal, selection });
    },
    filter(condition) {
      return createQueryBuilder({ ...internal, filter: condition });
    },
    take(limit, offset = null) {
      return createQueryBuilder({ ...internal, take: { limit, offset } });
    },
    sort(arg1, arg2, ...others) {
      const start: Array<OrderingTerm<Schema, TableName>> =
        typeof arg1 === 'string' ? [[arg1, arg2 ?? 'Asc']] : arg2 ? [arg1, arg2 as any] : [arg1];
      return createQueryBuilder({
        ...internal,
        sort: [...start, ...others],
      });
    },
    join(currentCol, table, joinCol) {
      return joinInternal('many', currentCol, table, joinCol);
    },
    joinOne(currentCol, table, joinCol) {
      return joinInternal('one', currentCol, table, joinCol);
    },
    joinMaybeOne(currentCol, table, joinCol) {
      return joinInternal('maybeOne', currentCol, table, joinCol);
    },
    joinFirst(currentCol, table, joinCol) {
      return joinInternal('first', currentCol, table, joinCol);
    },
    joinMaybeFirst(currentCol, table, joinCol) {
      return joinInternal('maybeFirst', currentCol, table, joinCol);
    },

    all() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return { kind: 'Query', sql, params, parse: (data) => groupRows(schema, resolvedJoins, data) };
    },
    one() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (data) => {
          const results = groupRows(schema, resolvedJoins, data);
          if (results.length !== 1) {
            throw new Error(`Expected 1 result, got ${results.length}`);
          }
          return results[0];
        },
      };
    },
    maybeOne() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (data) => {
          const results = groupRows(schema, resolvedJoins, data);
          if (results.length > 1) {
            throw new Error(`Expected maybe 1 result, got ${results.length}`);
          }
          return results[0] ?? null;
        },
      };
    },
    first() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (data) => {
          const results = groupRows(schema, resolvedJoins, data);
          if (results.length === 0) {
            throw new Error('Expected at least 1 result, got 0');
          }
          return results[0];
        },
      };
    },
    maybeFirst() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (data) => {
          const results = groupRows(schema, resolvedJoins, data);
          return results[0] ?? null;
        },
      };
    },
  };

  function joinInternal<JoinTableName extends TablesNames<Schema>, Kind extends JoinKind>(
    kind: Kind,
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, TableName>
  ): IQueryBuilder<Schema, JoinTableName, null, QueryParent<Schema, Kind, TableName, Selection, Parent>> {
    return createQueryBuilder({
      schema: internal.schema,
      table,
      take: null,
      selection: null,
      filter: null,
      sort: null,
      parent: {
        kind,
        currentCol: currentCol as string,
        joinCol: joinCol as string,
        query: internal as any,
      },
    });
  }
}
