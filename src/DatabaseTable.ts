import DB from 'better-sqlite3';
import { PipeCollection, PipeParent, PipeSingle } from './Pipe';
import { Select } from './Select';
import { notNil, PRIV, traverserFromRowIterator } from './Utils';
import { SchemaAny, SchemaIndexesAny, SchemaTableResolved, serializeColumnData } from './schema';
import { DataFromValues, serializeValues, ValuesAny } from './Values';
import { resolveStmt, sql, Table } from './sql';

type QueriesCache = {
  insert: DB.Statement | null;
  deleteByKey: DB.Statement | null;
  updateByKey: DB.Statement | null;
  selectAll: DB.Statement | null;
  findByKey: DB.Statement | null;
  countAll: DB.Statement | null;
};

export type DatabaseTableAny = DatabaseTable<
  string | number | symbol,
  any,
  any,
  SchemaIndexesAny<any>
>;

export class DatabaseTable<
  Name extends string | number | symbol,
  Key,
  Data,
  Indexes extends SchemaIndexesAny<Data>
> {
  readonly name: Name;
  readonly schema: SchemaAny;

  private readonly getDb: () => DB.Database;
  private readonly tableConfig: SchemaTableResolved;
  private readonly pipeParent: PipeParent<Key>;
  private readonly sqlTable: Table;

  private readonly cache: QueriesCache = {
    insert: null,
    deleteByKey: null,
    updateByKey: null,
    selectAll: null,
    findByKey: null,
    countAll: null,
  };

  constructor(name: Name, schema: SchemaAny, getDb: () => DB.Database) {
    this.name = name;
    this.schema = schema;
    this.getDb = getDb;
    this.tableConfig = notNil(schema.tables.find((table) => table.name === name));
    this.pipeParent = {
      deleteByKey: this.deleteByKey.bind(this),
      insert: this.insertInternal.bind(this),
      updateByKey: this.updateByKey.bind(this),
    };
    this.sqlTable = sql.Table.create(name as string);
  }

  private getStatement<Name extends keyof QueriesCache>(
    name: Name,
    create: () => QueriesCache[Name]
  ): NonNullable<QueriesCache[Name]> {
    if (this.cache[name] === null) {
      this.cache[name] = create();
    }
    return this.cache[name] as any;
  }

  private getDeleteByKeyQuery(): DB.Statement {
    return this.getStatement('deleteByKey', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const resolved = resolveStmt(
        sql.DeleteStmt.create({
          from: this.sqlTable,
          where: sql.eq(key, sql.Param.createAnonymous()),
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private getUpdateByKeyQuery(): DB.Statement {
    return this.getStatement('updateByKey', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const resolved = resolveStmt(
        sql.UpdateStmt.create({
          table: this.sqlTable,
          set: [
            [key, sql.Param.createAnonymous()],
            [this.sqlTable.column('data'), sql.Param.createAnonymous()],
            ...this.tableConfig.indexes.map(
              (index) => [this.sqlTable.column(index.name), sql.Param.createAnonymous()] as const
            ),
          ],
          where: sql.eq(key, sql.Param.createNamed('key')),
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private getInsertQuery(): DB.Statement {
    return this.getStatement('insert', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const data = this.sqlTable.column('data');
      const indexes = this.tableConfig.indexes.map((index) => this.sqlTable.column(index.name));
      const columns = [key, data, ...indexes] as const;
      const resolved = resolveStmt(
        sql.InsertStmt.create({
          into: this.sqlTable,
          columns: [...columns],
          values: [columns.map(() => sql.Param.createAnonymous())],
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private getSelectAllQuery(): DB.Statement {
    return this.getStatement('selectAll', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const data = this.sqlTable.column('data');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          columns: [key, data],
          from: this.sqlTable,
          orderBy: [key],
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private getFindByKeyQuery(): DB.Statement {
    return this.getStatement('findByKey', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const data = this.sqlTable.column('data');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          columns: [key, data],
          from: this.sqlTable,
          where: sql.eq(key, sql.Param.createAnonymous()),
        }).limit(sql.literal(1))
      );
      return db.prepare(resolved.query);
    });
  }

  private getCountAllQuery(): DB.Statement {
    return this.getStatement('countAll', (): DB.Statement => {
      const db = this.getDb();
      const key = this.sqlTable.column('key');
      const resolved = resolveStmt(
        sql.SelectStmt.create({
          columns: [sql.Aggregate.count(key).as('count')],
          from: this.sqlTable,
        })
      );
      return db.prepare(resolved.query);
    });
  }

  private prepareData(data: unknown): {
    key: Key;
    serailizedKey: any;
    data: string;
    indexes: Array<unknown>;
  } {
    const key = this.tableConfig.key.fn(data);
    const serailizedKey = serializeColumnData(this.tableConfig.key.column, key, 'key');
    const indexes = this.tableConfig.indexes.map((index) => {
      return serializeColumnData(index.column, index.fn(data), index.name);
    });
    const dataSer = JSON.stringify(this.schema.sanitize(data));
    return { key: key, serailizedKey, data: dataSer, indexes };
  }

  private deleteByKey(key: Key) {
    const serializedKey = serializeColumnData(this.tableConfig.key.column, key, 'key');
    this.getDeleteByKeyQuery().run(serializedKey);
  }

  private insertInternal(data: unknown): { newKey: Key } {
    const params = this.prepareData(data);
    this.getInsertQuery().run(params.serailizedKey, params.data, ...params.indexes);
    return { newKey: params.key };
  }

  private updateByKey(key: Key, data: unknown): { updatedKey: Key } {
    const prepared = this.prepareData(data);
    const serializedKey = serializeColumnData(this.tableConfig.key.column, key, 'key');
    const query = this.getUpdateByKeyQuery();
    const params: Array<any> = [
      prepared.serailizedKey,
      prepared.data,
      ...prepared.indexes,
      { key: serializedKey },
    ];
    query.run(...params);
    return { updatedKey: prepared.key };
  }

  private restore(data: string): Data {
    return this.schema.restore(JSON.parse(data)) as any;
  }

  insert(data: Data): PipeSingle<Key, Data, false> {
    const { newKey } = this.insertInternal(data);
    return new PipeSingle({ key: newKey, data }, this.pipeParent);
  }

  prepare(): Select<Key, Data, Indexes, null>;
  prepare<Params extends ValuesAny>(params: Params): Select<Key, Data, Indexes, Params>;
  prepare<Params extends ValuesAny>(params?: Params): Select<Key, Data, Indexes, Params | null> {
    return new Select({
      sqlTable: this.sqlTable,
      table: this.tableConfig,
      params: params ?? null,
      where: null,
      limit: null,
      orderBy: null,
    });
  }

  countAll(): number {
    const res = this.getCountAllQuery().get();
    return res.count;
  }

  count(query: Select<Key, Data, Indexes, null>): number;
  count<Params extends ValuesAny>(
    query: Select<Key, Data, Indexes, Params>,
    params: DataFromValues<Params>
  ): number;
  count<Params extends ValuesAny | null>(
    query: Select<Key, Data, Indexes, Params>,
    params?: Params extends ValuesAny ? DataFromValues<Params> : null
  ): number {
    const db = this.getDb();
    const preparedQuery = query[PRIV].getCountQuery(db);
    const paramsValues = query[PRIV].params;
    const paramsSerialized =
      paramsValues === null ? {} : serializeValues(paramsValues, params as any);
    return preparedQuery.get(paramsSerialized as any).count;
  }

  select(query: Select<Key, Data, Indexes, null>): PipeCollection<Key, Data>;
  select<Params extends ValuesAny>(
    query: Select<Key, Data, Indexes, Params>,
    params: DataFromValues<Params>
  ): PipeCollection<Key, Data>;
  select<Params extends ValuesAny | null>(
    query: Select<Key, Data, Indexes, Params>,
    params?: Params extends ValuesAny ? DataFromValues<Params> : null
  ): PipeCollection<Key, Data> {
    const db = this.getDb();
    const preparedQuery = query[PRIV].getSelectQuery(db);
    const paramsValues = query[PRIV].params;
    const paramsSerialized =
      paramsValues === null ? {} : serializeValues(paramsValues, params as any);
    const iter = preparedQuery.iterate(paramsSerialized as any);
    return new PipeCollection(
      traverserFromRowIterator<Key, string, Data>(iter, (data) => this.restore(data)),
      this.pipeParent
    );
  }

  all(): PipeCollection<Key, Data> {
    const iter = this.getSelectAllQuery().iterate();
    return new PipeCollection(
      traverserFromRowIterator<Key, string, Data>(iter, (data) => this.restore(data)),
      this.pipeParent
    );
  }

  findByKey(key: Key): PipeSingle<Key, Data, true> {
    const query = this.getFindByKeyQuery();
    const serializedKey = serializeColumnData(this.tableConfig.key.column, key, 'key');
    const entry = query.get(serializedKey);
    return new PipeSingle<Key, Data, true>(
      entry ? { key: entry.key as any, data: this.restore(entry.data as any) } : null,
      this.pipeParent
    );
  }
}
