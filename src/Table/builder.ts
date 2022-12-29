import { ResultMode } from '../Database';
import { Expr } from '../Expr';
import { IOperation, IQueryOperation, ResultFromMode } from '../Operation';
import { ISchemaAny } from '../Schema';
import { SchemaColumnOutputValue } from '../SchemaColumn';
import { ISchemaTableAny } from '../SchemaTable';
import { PRIV } from '../Utils';
import { groupRows } from './groupRows';
import { resolve } from './resolve';
import { ExtractTable, Result } from './types';

export type JoinKind = 'many' | 'one' | 'maybeOne' | 'first' | 'maybeFirst';

type QueryParent<
  Schema extends ISchemaAny,
  Kind extends JoinKind,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> = {
  kind: Kind;
  currentCol: string;
  joinCol: string;
  query: DatabaseTableQueryInternal<Schema, TableName, ISchemaTableAny, Selection, Parent>;
};

export type QueryParentBase<Schema extends ISchemaAny> = QueryParent<
  Schema,
  JoinKind,
  keyof Schema['tables'],
  ISchemaTableAny,
  SelectionBase<ISchemaTableAny> | null,
  any
>;

export type OrderDirection = 'Asc' | 'Desc';

export type OrderingTerm<SchemaTable extends ISchemaTableAny> = [ExtractColumnsNames<SchemaTable>, OrderDirection];

export type ExtractColumnsNames<SchemaTable extends ISchemaTableAny> = keyof SchemaTable[PRIV]['columns'];

export type SelectionBase<SchemaTable extends ISchemaTableAny> = {
  [K in ExtractColumnsNames<SchemaTable>]?: true;
};

export type WhereBase<SchemaTable extends ISchemaTableAny> = {
  [K in ExtractColumnsNames<SchemaTable>]?:
    | SchemaColumnOutputValue<SchemaTable[PRIV]['columns'][K]>
    | Expr<SchemaColumnOutputValue<SchemaTable[PRIV]['columns'][K]>>;
};

/**
 * Internal state of a DatabaseTableQuery
 */
export type DatabaseTableQueryInternal<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> = Readonly<{
  schema: Schema;
  operationResolver: (op: IOperation) => any;
  table: TableName;
  selection: Selection;
  filter: WhereBase<SchemaTable> | null;
  take: null | { limit: number | null; offset: number | null };
  sort: null | Array<OrderingTerm<SchemaTable>>;
  parent: Parent;
}>;

export type DatabaseTableQueryInternalAny = DatabaseTableQueryInternal<
  ISchemaAny,
  any,
  any,
  SelectionBase<any> | null,
  QueryParentBase<any> | null
>;

export interface IQueryBuilder<
  Schema extends ISchemaAny,
  Mode extends ResultMode,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> {
  readonly [PRIV]: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>;

  select<Selection extends SelectionBase<SchemaTable>>(
    selection: Selection
  ): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent>;

  filter(condition: WhereBase<SchemaTable>): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent>;

  take(limit: number | null, offset?: number | null): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent>;

  sort(
    column: ExtractColumnsNames<SchemaTable>,
    direction?: OrderDirection
  ): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent>;
  sort(
    arg1: OrderingTerm<SchemaTable>,
    ...others: Array<OrderingTerm<SchemaTable>>
  ): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent>;

  join<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'many', TableName, SchemaTable, Selection, Parent>
  >;

  joinOne<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'one', TableName, SchemaTable, Selection, Parent>
  >;

  joinMaybeOne<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'maybeOne', TableName, SchemaTable, Selection, Parent>
  >;

  joinFirst<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'first', TableName, SchemaTable, Selection, Parent>
  >;

  joinMaybeFirst<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'maybeFirst', TableName, SchemaTable, Selection, Parent>
  >;

  // Returns an Array
  all(): ResultFromMode<Mode, IQueryOperation<Array<Result<Schema, TableName, Selection, Parent>>>>;
  // Throw if result count is not === 1
  one(): ResultFromMode<Mode, IQueryOperation<Result<Schema, TableName, Selection, Parent>>>;
  // Throw if result count is > 1
  maybeOne(): ResultFromMode<Mode, IQueryOperation<Result<Schema, TableName, Selection, Parent> | null>>;
  // Throw if result count is === 0
  first(): ResultFromMode<Mode, IQueryOperation<Result<Schema, TableName, Selection, Parent>>>;
  // Never throws
  maybeFirst(): ResultFromMode<Mode, IQueryOperation<Result<Schema, TableName, Selection, Parent> | null>>;
}

export type IQueryBuilderAny = IQueryBuilder<ISchemaAny, ResultMode, any, any, any, any>;

export function builder<Schema extends ISchemaAny, Mode extends ResultMode, TableName extends keyof Schema['tables']>(
  schema: Schema,
  operationResolver: (op: IOperation) => any,
  table: TableName
): IQueryBuilder<Schema, Mode, TableName, ExtractTable<Schema, TableName>, null, null> {
  return createBuilder({ schema, operationResolver, table, selection: null, filter: null, take: null, parent: null, sort: null });
}

function createBuilder<
  Schema extends ISchemaAny,
  Mode extends ResultMode,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
>(
  internal: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>
): IQueryBuilder<Schema, Mode, TableName, SchemaTable, Selection, Parent> {
  return {
    [PRIV]: internal,
    select(selection) {
      return createBuilder({ ...internal, selection });
    },
    filter(condition) {
      return createBuilder({ ...internal, filter: condition });
    },
    take(limit, offset = null) {
      return createBuilder({ ...internal, take: { limit, offset } });
    },
    sort(arg1, arg2, ...others) {
      const start: Array<OrderingTerm<SchemaTable>> =
        typeof arg1 === 'string' ? [[arg1, arg2 ?? 'Asc']] : arg2 ? [arg1, arg2 as any] : [arg1];
      return createBuilder({
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
      return internal.operationResolver({ kind: 'Query', sql, params, parse: (data) => groupRows(schema, resolvedJoins, data) });
    },
    one() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return internal.operationResolver({
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
      });
    },
    maybeOne() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return internal.operationResolver({
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
      });
    },
    first() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return internal.operationResolver({
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
      });
    },
    maybeFirst() {
      const { sql, params, schema, resolvedJoins } = resolve(internal);
      return internal.operationResolver({
        kind: 'Query',
        sql,
        params,
        parse: (data) => {
          const results = groupRows(schema, resolvedJoins, data);
          return results[0] ?? null;
        },
      });
    },
  };

  function joinInternal<JoinTableName extends keyof Schema['tables'], Kind extends JoinKind>(
    kind: Kind,
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): IQueryBuilder<
    Schema,
    Mode,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, Kind, TableName, SchemaTable, Selection, Parent>
  > {
    return createBuilder({
      schema: internal.schema,
      operationResolver: internal.operationResolver,
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
