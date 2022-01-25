import { SchemaIndexesAny, SchemaTableResolved } from './schema';
import { PRIV, mapObject } from './Utils';
import { ValuesAny } from './Values';
import DB from 'better-sqlite3';
import { Expr, resolveStmt, sql, Param, Column, Table } from './sql';

export type SelectInternalData<Params extends ValuesAny | null> = {
  table: SchemaTableResolved;
  sqlTable: Table;
  params: Params;
  where: Expr | null;
  orderBy: Array<Expr> | null;
  limit: { limit: Expr; offset: Expr | null } | null;
};

export type SelectInternalLocal = {
  getSelectQuery(db: DB.Database): DB.Statement;
  getCountQuery(db: DB.Database): DB.Statement;
};

export type SelectInternal<Params extends ValuesAny | null> = SelectInternalData<Params> &
  SelectInternalLocal;

export type IndexesRefs<Indexes extends SchemaIndexesAny<any>> = {
  [K in Indexes[number]['name']]: Column;
};

export type ParamsRef<Params extends ValuesAny> = {
  [K in keyof Params]: Param;
};

export type ToolsFn<Indexes extends SchemaIndexesAny<any>, Params extends ValuesAny | null, Res> = (
  tools: SelectTools<Indexes, Params>
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

export type SelectTools<Indexes extends SchemaIndexesAny<any>, Params extends ValuesAny | null> = {
  indexes: IndexesRefs<Indexes>;
  params: Params extends ValuesAny ? ParamsRef<Params> : {};
};

type QueriesCache = {
  select: DB.Statement | null;
  count: DB.Statement | null;
};

export class Select<
  Key,
  Data,
  Indexes extends SchemaIndexesAny<any>,
  Params extends ValuesAny | null
> {
  private readonly cache: QueriesCache = {
    select: null,
    count: null,
  };

  readonly [PRIV]: SelectInternal<Params>;

  constructor(internal: SelectInternalData<Params>) {
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
      const key = sqlTable.column('key');
      const data = sqlTable.column('data');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          select: [key, data],
          from: sqlTable,
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
      const key = sqlTable.column('key');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          select: [sql.Aggregate.count(key).as('count')],
          from: sqlTable,
          where,
          limit,
          orderBy,
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private resolveValOrToolsFn<Res>(value: ValOrToolsFn<Indexes, Params, Res>, params: Params): Res {
    const { table, sqlTable } = this[PRIV];
    if (typeof value === 'function') {
      const paramsRefs = mapObject<ValuesAny, Record<string, Param>>(
        params ?? {},
        (paramName: string): Param => sql.Param.createNamed(paramName)
      );

      const indexesRefs = Object.fromEntries(
        table.indexes.map((index): [string, Column] => {
          return [index.name, sqlTable.column(index.name)];
        })
      );
      const tools: SelectTools<Indexes, Params> = {
        indexes: indexesRefs as any,
        params: paramsRefs as any,
      };
      return (value as any)(tools);
    }
    return value;
  }

  where(expr: ExprOrExprFn<Indexes, Params>): Select<Key, Data, Indexes, Params> {
    return new Select({
      ...this[PRIV],
      where: this.resolveValOrToolsFn(expr, this[PRIV].params),
    });
  }

  limit(
    limit: ExprOrExprFn<Indexes, Params>,
    offset: ExprOrExprFn<Indexes, Params> | null = null
  ): Select<Key, Data, Indexes, Params> {
    return new Select({
      ...this[PRIV],
      limit: {
        limit: this.resolveValOrToolsFn(limit, this[PRIV].params),
        offset: offset === null ? null : this.resolveValOrToolsFn(offset, this[PRIV].params),
      },
    });
  }

  orderBy(expr: ValOrToolsFn<Indexes, Params, Array<Expr>>): Select<Key, Data, Indexes, Params> {
    return new Select({
      ...this[PRIV],
      orderBy: this.resolveValOrToolsFn(expr, this[PRIV].params),
    });
  }
}
