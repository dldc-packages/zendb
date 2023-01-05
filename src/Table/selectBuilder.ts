import { IExpr } from '../Expr';
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
  Fields extends FieldsBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> = {
  kind: Kind;
  currentCol: string;
  joinCol: string;
  query: DatabaseTableQueryInternal<Schema, TableName, Fields, Parent>;
};

export type QueryParentBase<Schema extends ISchemaAny> = QueryParent<
  Schema,
  JoinKind,
  keyof Schema['tables'],
  FieldsBase<Schema, keyof Schema['tables']> | null,
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

export type FieldsBase<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = {
  [K in ExtractColumnsNames<Schema, TableName>]?: true;
};

export type WhereBase<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = {
  [K in ExtractColumnsNames<Schema, TableName>]?:
    | SchemaColumnOutputValue<ExtractTable<Schema, TableName>[PRIV]['columns'][K]>
    | IExpr<SchemaColumnOutputValue<ExtractTable<Schema, TableName>[PRIV]['columns'][K]>>;
};

/**
 * Internal state of a DatabaseTableQuery
 */
export type DatabaseTableQueryInternal<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Fields extends FieldsBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> = Readonly<{
  schema: Schema;
  table: TableName;
  fields: Fields;
  filter: WhereBase<Schema, TableName> | null;
  take: null | { limit: number | null; offset: number | null };
  sort: null | Array<OrderingTerm<Schema, TableName>>;
  parent: Parent;
}>;

export interface ISelectBuilder<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Fields extends FieldsBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> {
  readonly [PRIV]: DatabaseTableQueryInternal<Schema, TableName, Fields, Parent>;

  fields<Fields extends FieldsBase<Schema, TableName>>(fields: Fields): ISelectBuilder<Schema, TableName, Fields, Parent>;

  filter(condition: WhereBase<Schema, TableName>): ISelectBuilder<Schema, TableName, Fields, Parent>;

  take(limit: number | null, offset?: number | null): ISelectBuilder<Schema, TableName, Fields, Parent>;

  sort(column: ExtractColumnsNames<Schema, TableName>, direction?: OrderDirection): ISelectBuilder<Schema, TableName, Fields, Parent>;
  sort(
    arg1: OrderingTerm<Schema, TableName>,
    ...others: Array<OrderingTerm<Schema, TableName>>
  ): ISelectBuilder<Schema, TableName, Fields, Parent>;

  join<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'many', TableName, Fields, Parent>>;

  joinOne<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'one', TableName, Fields, Parent>>;

  joinMaybeOne<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'maybeOne', TableName, Fields, Parent>>;

  joinFirst<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'first', TableName, Fields, Parent>>;

  joinMaybeFirst<JoinTableName extends TablesNames<Schema>>(
    currentCol: ExtractColumnsNames<Schema, TableName>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<Schema, JoinTableName>
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, 'maybeFirst', TableName, Fields, Parent>>;

  // Returns an Array
  all(): IQueryOperation<Array<Result<Schema, TableName, Fields, Parent>>>;
  // Throw if result count is not === 1
  one(): IQueryOperation<Result<Schema, TableName, Fields, Parent>>;
  // Throw if result count is > 1
  maybeOne(): IQueryOperation<Result<Schema, TableName, Fields, Parent> | null>;
  // Throw if result count is === 0
  first(): IQueryOperation<Result<Schema, TableName, Fields, Parent>>;
  // Never throws
  maybeFirst(): IQueryOperation<Result<Schema, TableName, Fields, Parent> | null>;
}

export type ISelectBuilderAny = ISelectBuilder<ISchemaAny, any, any, any>;

export function selectBuilder<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
  schema: Schema,
  table: TableName
): ISelectBuilder<Schema, TableName, null, null> {
  return createSelectBuilder({ schema, table, fields: null, filter: null, take: null, parent: null, sort: null });
}

function createSelectBuilder<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Fields extends FieldsBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
>(internal: DatabaseTableQueryInternal<Schema, TableName, Fields, Parent>): ISelectBuilder<Schema, TableName, Fields, Parent> {
  return {
    [PRIV]: internal,
    fields(fields) {
      return createSelectBuilder({ ...internal, fields: fields });
    },
    filter(condition) {
      return createSelectBuilder({ ...internal, filter: condition });
    },
    take(limit, offset = null) {
      return createSelectBuilder({ ...internal, take: { limit, offset } });
    },
    sort(arg1, arg2, ...others) {
      const start: Array<OrderingTerm<Schema, TableName>> =
        typeof arg1 === 'string' ? [[arg1, arg2 ?? 'Asc']] : arg2 ? [arg1, arg2 as any] : [arg1];
      return createSelectBuilder({
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
  ): ISelectBuilder<Schema, JoinTableName, null, QueryParent<Schema, Kind, TableName, Fields, Parent>> {
    return createSelectBuilder({
      schema: internal.schema,
      table,
      take: null,
      fields: null,
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
