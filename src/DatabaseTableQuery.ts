import { SchemaColumnOutputValue, Infer, SchemaAny, SchemaTableAny, SchemaColumnAny, parseColumn } from './schema';
import { PRIV, arrayEqual, expectNever } from './Utils';
import { Node, printNode } from 'zensqlite';
import { Expr } from './Expr';
import { paramsFromMap, Resolved, resolveQuery, resolvedQueryToSelect, ResolvedQuery, ResolvedJoinItem, dotCol } from './QueryUtils';
import { IDriverDatabase, IDriverStatement } from './Driver';

export type Rows = Array<Record<string, unknown>>;
export type SelectFrom = Extract<Node<'SelectCore'>, { variant: 'Select' }>['from'];
export type SelectOrderBy = Node<'SelectStmt'>['orderBy'];

export type ExtractTable<Schema extends SchemaAny, TableName extends keyof Schema['tables']> = Schema['tables'][TableName];

export type SelectionPick<
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable>
> = keyof Selection extends keyof Infer<SchemaTable> ? Pick<Infer<SchemaTable>, keyof Selection> : undefined;

export type ResultSelf<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  Selection extends SelectionBase<ExtractTable<Schema, TableName>> | null
> = Selection extends SelectionBase<ExtractTable<Schema, TableName>>
  ? SelectionPick<ExtractTable<Schema, TableName>, Selection>
  : undefined;

export type KindMapper<Inner, Kind extends JoinKind> = {
  many: Array<Inner>;
  one: Inner;
  maybeOne: Inner | null;
  first: Inner;
  maybeFirst: Inner | null;
}[Kind];

export type MergeInnerAndParent<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  Kind extends JoinKind,
  Parent,
  Inner
> = Parent extends undefined
  ? Inner extends undefined
    ? undefined
    : KindMapper<Inner, Kind>
  : Inner extends undefined
  ? Parent
  : Parent & { [K in TableName]: KindMapper<Inner, Kind> };

export type ParentResult<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  Parent extends QueryParentBase<Schema>,
  Inner
> = MergeInnerAndParent<
  Schema,
  TableName,
  Parent['kind'],
  ResultSelf<Schema, Parent['query']['table'], Parent['query']['selection']>,
  Inner
>;

export type WrapInParent<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  Inner,
  Parent extends null | QueryParentBase<Schema>
> = Parent extends QueryParentBase<Schema>
  ? WrapInParent<Schema, Parent['query']['table'], ParentResult<Schema, TableName, Parent, Inner>, Parent['query']['parent']>
  : Inner;

export type Result<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  Selection extends SelectionBase<ExtractTable<Schema, TableName>> | null,
  Parent extends null | QueryParentBase<Schema>
> = WrapInParent<Schema, TableName, ResultSelf<Schema, TableName, Selection>, Parent>;

export type ExtractColumnsNames<SchemaTable extends SchemaTableAny> = keyof SchemaTable[PRIV]['columns'];

export type SelectionBase<SchemaTable extends SchemaTableAny> = {
  [K in ExtractColumnsNames<SchemaTable>]?: true;
};

export type WhereBase<SchemaTable extends SchemaTableAny> = {
  [K in ExtractColumnsNames<SchemaTable>]?:
    | SchemaColumnOutputValue<SchemaTable[PRIV]['columns'][K]>
    | Expr<SchemaColumnOutputValue<SchemaTable[PRIV]['columns'][K]>>;
};

export type JoinKind = 'many' | 'one' | 'maybeOne' | 'first' | 'maybeFirst';

type QueryParent<
  Schema extends SchemaAny,
  Kind extends JoinKind,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> = {
  kind: Kind;
  currentCol: string;
  joinCol: string;
  query: DatabaseTableQueryInternal<Schema, TableName, SchemaTableAny, Selection, Parent>;
};

type QueryParentBase<Schema extends SchemaAny> = QueryParent<
  Schema,
  JoinKind,
  keyof Schema['tables'],
  SchemaTableAny,
  SelectionBase<SchemaTableAny> | null,
  any
>;

export type OrderDirection = 'Asc' | 'Desc';

export type OrderingTerm<SchemaTable extends SchemaTableAny> = [ExtractColumnsNames<SchemaTable>, OrderDirection];

/**
 * Base Actions of a Query
 */
export interface DatabaseTableQueryActions<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> {
  // Returns an Array
  all(): Array<Result<Schema, TableName, Selection, Parent>>;
  // Throw if result count is not === 1
  one(): Result<Schema, TableName, Selection, Parent>;
  // Throw if result count is > 1
  maybeOne(): Result<Schema, TableName, Selection, Parent> | null;
  // Throw if result count is === 0
  first(): Result<Schema, TableName, Selection, Parent>;
  // Never throws
  maybeFirst(): Result<Schema, TableName, Selection, Parent> | null;
}

export interface DatabaseTableQueryPrepared<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> extends DatabaseTableQueryActions<Schema, TableName, SchemaTable, Selection, Parent> {
  // Clear memory of prepared query
  free(): void;
}

/**
 * Internal state of a DatabaseTableQuery
 */
type DatabaseTableQueryInternal<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> = Readonly<{
  schema: Schema;
  table: TableName;
  selection: Selection;
  filter: WhereBase<SchemaTable> | null;
  take: null | { limit: number | null; offset: number | null };
  sort: null | Array<OrderingTerm<SchemaTable>>;
  parent: Parent;
}>;

export type DatabaseTableQueryInternalAny = DatabaseTableQueryInternal<
  SchemaAny,
  any,
  any,
  SelectionBase<any> | null,
  QueryParentBase<any> | null
>;

export class DatabaseTableQuery<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> implements DatabaseTableQueryPrepared<Schema, TableName, SchemaTable, Selection, Parent>
{
  static create<
    DriverStatement extends IDriverStatement,
    DriverDatabase extends IDriverDatabase<DriverStatement>,
    Schema extends SchemaAny,
    TableName extends keyof Schema['tables']
  >(
    driverDatabase: DriverDatabase,
    schema: Schema,
    table: TableName
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, ExtractTable<Schema, TableName>, null, null> {
    return new DatabaseTableQuery(driverDatabase, { schema, table, selection: null, filter: null, take: null, parent: null, sort: null });
  }

  private preparedStatement: { statement: DriverStatement; free: boolean } | null = null;
  private resolved: Resolved | null = null;

  readonly [PRIV]: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>;
  readonly driverDatabase: DriverDatabase;

  private constructor(
    driverDatabase: DriverDatabase,
    internal: DatabaseTableQueryInternal<Schema, TableName, SchemaTable, Selection, Parent>
  ) {
    this.driverDatabase = driverDatabase;
    this[PRIV] = internal;
  }

  private getResolved(): Resolved {
    const schema = this[PRIV].schema;
    if (this.resolved !== null) {
      return this.resolved;
    }
    this.resolved = resolveQuery(schema, this[PRIV], null, 0);
    return this.resolved;
  }

  private getStatement(): DriverStatement {
    if (this.preparedStatement) {
      return this.preparedStatement.statement;
    }
    const { query, params } = this.getQueryText();
    const statement = this.driverDatabase.prepare(query);
    if (params !== null) {
      statement.bind(params);
    }
    return statement;
  }

  private getResults(): Array<Record<string, any>> {
    if (this.preparedStatement && this.preparedStatement.free) {
      throw new Error('Cannot use a prepared statement that has been freed');
    }
    const statement = this.getStatement();
    const res = statement.all();
    if (this.preparedStatement === null) {
      statement.free();
    }
    return res;
  }

  private getQueryText(): { query: string; params: Record<string, any> | null } {
    // map values to params names
    const paramsMap = new Map<any, string>();
    const [baseQuery, joins] = this.getResolved();
    const tables = this[PRIV].schema.tables;
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
    return { query: queryText, params };
  }

  private buildResult(rows: Array<Record<string, unknown>>): Array<any> {
    const [query, joins] = this.getResolved();
    const schema = this[PRIV].schema;

    return groupRows(query, joins, rows);

    function getColumnSchema(table: string, column: string): SchemaColumnAny {
      const tableSchema = schema.tables[table];
      if (!tableSchema) {
        throw new Error(`Table "${table}" not found`);
      }
      const columnSchema = tableSchema[PRIV].columns[column];
      if (!columnSchema) {
        throw new Error(`Column "${column}" not found in table "${table}"`);
      }
      return columnSchema;
    }

    function transformJoin(results: Array<any>, kind: JoinKind): any {
      if (kind === 'many') {
        return results;
      }
      if (kind === 'maybeFirst') {
        return results[0] ?? null;
      }
      if (kind === 'first') {
        if (results.length === 0) {
          throw new Error('No result for a single join');
        }
        return results[0];
      }
      if (results.length > 1) {
        throw new Error('Multiple results for a single join');
      }
      if (kind === 'maybeOne') {
        return results[0] ?? null;
      }
      if (kind === 'one') {
        if (results.length === 0) {
          throw new Error('No result for a single join');
        }
        return results[0];
      }
      return expectNever(kind);
    }

    function groupRows(query: ResolvedQuery, joins: Array<ResolvedJoinItem>, rows: Array<Record<string, unknown>>): Array<any> {
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
            const colSchema = getColumnSchema(query.table, col);
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
        const joinResult = groupRows(join.query, nextJoins, group.rows);
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
  }

  select<Selection extends SelectionBase<SchemaTable>>(
    selection: Selection
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent> {
    return new DatabaseTableQuery(this.driverDatabase, {
      ...this[PRIV],
      selection,
    });
  }

  filter(
    condition: WhereBase<SchemaTable>
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent> {
    return new DatabaseTableQuery(this.driverDatabase, {
      ...this[PRIV],
      filter: condition,
    });
  }

  take(
    limit: number | null,
    offset: number | null = null
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent> {
    return new DatabaseTableQuery(this.driverDatabase, {
      ...this[PRIV],
      take: { limit, offset },
    });
  }

  sort(
    column: ExtractColumnsNames<SchemaTable>,
    direction?: OrderDirection
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent>;
  sort(
    arg1: OrderingTerm<SchemaTable>,
    ...others: Array<OrderingTerm<SchemaTable>>
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent>;
  sort(
    arg1: OrderingTerm<SchemaTable> | ExtractColumnsNames<SchemaTable>,
    arg2?: OrderingTerm<SchemaTable> | OrderDirection,
    ...others: Array<OrderingTerm<SchemaTable>>
  ): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, SchemaTable, Selection, Parent> {
    const start: Array<OrderingTerm<SchemaTable>> =
      typeof arg1 === 'string' ? [[arg1, arg2 ?? 'Asc']] : arg2 ? [arg1, arg2 as any] : [arg1];
    return new DatabaseTableQuery(this.driverDatabase, {
      ...this[PRIV],
      sort: [...start, ...others],
    });
  }

  private joinInternal<JoinTableName extends keyof Schema['tables'], Kind extends JoinKind>(
    kind: Kind,
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, Kind, TableName, SchemaTable, Selection, Parent>
  > {
    return new DatabaseTableQuery(this.driverDatabase, {
      schema: this[PRIV].schema,
      table,
      take: null,
      selection: null,
      filter: null,
      sort: null,
      parent: {
        kind,
        currentCol: currentCol as string,
        joinCol: joinCol as string,
        query: this[PRIV] as any,
      },
    });
  }

  /**
   * Create left join
   */
  join<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'many', TableName, SchemaTable, Selection, Parent>
  > {
    return this.joinInternal('many', currentCol, table, joinCol);
  }

  joinOne<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'one', TableName, SchemaTable, Selection, Parent>
  > {
    return this.joinInternal('one', currentCol, table, joinCol);
  }

  joinMaybeOne<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'maybeOne', TableName, SchemaTable, Selection, Parent>
  > {
    return this.joinInternal('maybeOne', currentCol, table, joinCol);
  }

  joinFirst<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'first', TableName, SchemaTable, Selection, Parent>
  > {
    return this.joinInternal('first', currentCol, table, joinCol);
  }

  joinMaybeFirst<JoinTableName extends keyof Schema['tables']>(
    currentCol: ExtractColumnsNames<SchemaTable>,
    table: JoinTableName,
    joinCol: ExtractColumnsNames<ExtractTable<Schema, JoinTableName>>
  ): DatabaseTableQuery<
    DriverStatement,
    DriverDatabase,
    Schema,
    JoinTableName,
    ExtractTable<Schema, JoinTableName>,
    null,
    QueryParent<Schema, 'maybeFirst', TableName, SchemaTable, Selection, Parent>
  > {
    return this.joinInternal('maybeFirst', currentCol, table, joinCol);
  }

  // Prepare
  prepare(): DatabaseTableQueryPrepared<Schema, TableName, SchemaTable, Selection, Parent> {
    if (this.preparedStatement) {
      throw new Error('Query already prepared');
    }
    this.preparedStatement = { statement: this.getStatement(), free: false };
    return this;
  }

  free(): void {
    if (!this.preparedStatement) {
      console.warn('Calling free on a query that was not prepared is a no-op');
      return;
    }
    if (this.preparedStatement.free) {
      console.warn('Calling free on a query that was already freed is a no-op');
      return;
    }
    this.preparedStatement.statement.free();
    this.preparedStatement.free = true;
  }

  // run queries

  all(): Array<Result<Schema, TableName, Selection, Parent>> {
    const rows = this.getResults();
    return this.buildResult(rows);
  }

  /**
   * Throw if result count is not === 1
   */
  one(): Result<Schema, TableName, Selection, Parent> {
    const rows = this.getResults();
    const results = this.buildResult(rows);
    if (results.length !== 1) {
      throw new Error(`Expected 1 result, got ${results.length}`);
    }
    return results[0];
  }

  /**
   * Throw if result count is > 1
   */
  maybeOne(): Result<Schema, TableName, Selection, Parent> | null {
    const rows = this.getResults();
    const results = this.buildResult(rows);
    if (results.length > 1) {
      throw new Error(`Expected maybe 1 result, got ${results.length}`);
    }
    return results[0] ?? null;
  }

  /**
   * Throw if result count is === 0
   */
  first(): Result<Schema, TableName, Selection, Parent> {
    const rows = this.getResults();
    const results = this.buildResult(rows);
    if (results.length === 0) {
      throw new Error('Expected at least 1 result, got 0');
    }
    return results[0];
  }

  /**
   * Never throws
   */
  maybeFirst(): Result<Schema, TableName, Selection, Parent> | null {
    const rows = this.getResults();
    const results = this.buildResult(rows);
    return results[0] ?? null;
  }
}
