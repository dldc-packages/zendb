import { PRIV, mapObject, mergeSets, mapMaybe } from './Utils';
import DB from 'better-sqlite3';
import {
  Expr,
  resolveStmt,
  sql,
  Param,
  Column,
  Table,
  JsonTable,
  printNode,
  ValuesAny,
  extractColumns,
} from './sql';
import { SchemaIndexesAny, SchemaTableInternalAny } from './SchemaTable';

export type PreparedQueryInternalData<Params extends ValuesAny | null> = {
  table: SchemaTableInternalAny;
  sqlTable: Table;
  params: Params;
  paramsRefs: Record<string, Param> | null;
  indexesRefs: Record<string, Column>;
  where: Expr | null;
  orderBy: Array<Expr> | null;
  limit: { limit: Expr; offset: Expr | null } | null;
};

export type PreparedQueryInternalLocal = {
  getSelectQuery(db: DB.Database): DB.Statement;
  getCountQuery(db: DB.Database): DB.Statement;
};

export type PreparedQueryInternal<Params extends ValuesAny | null> =
  PreparedQueryInternalData<Params> & PreparedQueryInternalLocal;

export type IndexesRefs<Indexes extends SchemaIndexesAny<any>> = {
  [K in Indexes[number]['name']]: Column;
};

export type ParamsRef<Params extends ValuesAny> = {
  [K in keyof Params]: Param;
};

export type ToolsFn<Indexes extends SchemaIndexesAny<any>, Params extends ValuesAny | null, Res> = (
  tools: PreparedQueryTools<Indexes, Params>
) => Res;

export type ValOrToolsFn<
  Indexes extends SchemaIndexesAny<any>,
  Params extends ValuesAny | null,
  Res
> = Res | ToolsFn<Indexes, Params, Res>;

export type ExprOrExprFn<
  Indexes extends SchemaIndexesAny<any>,
  Params extends ValuesAny | null
> = ValOrToolsFn<Indexes, Params, Expr>;

export type PreparedQueryTools<
  Indexes extends SchemaIndexesAny<any>,
  Params extends ValuesAny | null
> = {
  indexes: IndexesRefs<Indexes>;
  params: Params extends ValuesAny ? ParamsRef<Params> : {};
};

type QueriesCache = {
  select: DB.Statement | null;
  count: DB.Statement | null;
};

type PreparedQueryOptions<Params extends ValuesAny | null> = {
  table: SchemaTableInternalAny;
  sqlTable: Table;
  params: Params;
  where: Expr | null;
  orderBy: Array<Expr> | null;
  limit: { limit: Expr; offset: Expr | null } | null;
};

export class PreparedQuery<
  Key,
  Data,
  Indexes extends SchemaIndexesAny<any>,
  Params extends ValuesAny | null
> {
  private readonly cache: QueriesCache = {
    select: null,
    count: null,
  };

  readonly [PRIV]: PreparedQueryInternal<Params>;

  static create<Key, Data, Indexes extends SchemaIndexesAny<any>, Params extends ValuesAny | null>({
    table,
    sqlTable,
    params,
    limit,
    orderBy,
    where,
  }: PreparedQueryOptions<Params>): PreparedQuery<Key, Data, Indexes, Params> {
    const paramsRefs = mapObject<ValuesAny, Record<string, Param>>(
      params ?? {},
      (paramName: string): Param => sql.Param.createNamed(paramName)
    );

    const indexesRefs = Object.fromEntries(
      table.indexes.map((index): [string, Column] => {
        const { datatype } = index.value[PRIV];
        if (datatype[PRIV].kind === 'jsonArray') {
          // Use json_each
          const col = sqlTable.column(index.name).as(index.name);
          const table = sql.JsonTable.each(col);
          return [index.name, table.columns.value];
        }
        return [index.name, sqlTable.column(index.name)];
      })
    );

    return new PreparedQuery({
      table,
      sqlTable,
      params,
      limit,
      orderBy,
      where,
      indexesRefs,
      paramsRefs,
    });
  }

  private constructor(internal: PreparedQueryInternalData<Params>) {
    this[PRIV] = {
      ...internal,
      getSelectQuery: this.getSelectQuery.bind(this),
      getCountQuery: this.getCountQuery.bind(this),
    };
  }

  private getQuery<Name extends keyof QueriesCache>(
    name: Name,
    create: () => QueriesCache[Name]
  ): NonNullable<QueriesCache[Name]> {
    if (this.cache[name] === null) {
      this.cache[name] = create();
    }
    return this.cache[name] as any;
  }

  private getSelectQuery(db: DB.Database): DB.Statement {
    return this.getQuery('select', () => {
      const { where, limit, orderBy, sqlTable } = this[PRIV];
      const columns = mergeSets(
        extractColumns(where),
        mapMaybe(orderBy, (exprs) => mergeSets(...exprs.map(extractColumns))),
        mapMaybe(limit, ({ limit, offset }) =>
          mergeSets(extractColumns(limit), extractColumns(offset))
        )
      );
      const tables = extractJsonTable(columns, sqlTable);
      const key = sqlTable.column('key');
      const data = sqlTable.column('data');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          distinct: tables.size > 1,
          columns: [key, data],
          from: Array.from(tables),
          where,
          limit,
          orderBy,
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private getCountQuery(db: DB.Database) {
    return this.getQuery('count', () => {
      const { where, limit, orderBy, sqlTable } = this[PRIV];
      const columns = mergeSets(
        extractColumns(where),
        mapMaybe(orderBy, (exprs) => mergeSets(...exprs.map(extractColumns))),
        mapMaybe(limit, ({ limit, offset }) =>
          mergeSets(extractColumns(limit), extractColumns(offset))
        )
      );
      const tables = extractJsonTable(columns, sqlTable);
      const key = sqlTable.column('key');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          columns: [sql.Aggregate.count(key).distinct().as('count')],
          from: Array.from(tables),
          where,
          limit,
          orderBy,
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private resolveValOrToolsFn<Res>(value: ValOrToolsFn<Indexes, Params, Res>): Res {
    const { paramsRefs, indexesRefs } = this[PRIV];
    if (typeof value === 'function') {
      const tools: PreparedQueryTools<Indexes, Params> = {
        indexes: indexesRefs as any,
        params: paramsRefs as any,
      };
      return (value as any)(tools);
    }
    return value;
  }

  where(expr: ExprOrExprFn<Indexes, Params>): PreparedQuery<Key, Data, Indexes, Params> {
    return new PreparedQuery({
      ...this[PRIV],
      where: this.resolveValOrToolsFn(expr),
    });
  }

  limit(
    limit: ExprOrExprFn<Indexes, Params>,
    offset: ExprOrExprFn<Indexes, Params> | null = null
  ): PreparedQuery<Key, Data, Indexes, Params> {
    return new PreparedQuery({
      ...this[PRIV],
      limit: {
        limit: this.resolveValOrToolsFn(limit),
        offset: offset === null ? null : this.resolveValOrToolsFn(offset),
      },
    });
  }

  orderBy(
    expr: ValOrToolsFn<Indexes, Params, Array<Expr>>
  ): PreparedQuery<Key, Data, Indexes, Params> {
    return new PreparedQuery({
      ...this[PRIV],
      orderBy: this.resolveValOrToolsFn(expr),
    });
  }
}

function extractJsonTable(columns: Set<Column>, mainTable: Table): Set<Table | JsonTable> {
  const tables = new Set<Table | JsonTable>([mainTable]);
  columns.forEach((column) => {
    const { table } = column[PRIV];
    if (table === mainTable) {
      return;
    }
    if (table instanceof sql.JsonTable) {
      const baseTable = table[PRIV].sourceColumn[PRIV].table;
      if (baseTable === mainTable) {
        tables.add(table);
        return;
      }
    }
    throw new Error(`Invalid column ${printNode(column, 'ref')}`);
  });
  return tables;
}
