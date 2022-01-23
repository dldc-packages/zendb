import { PipeCollection, PipeParent, PipeSingle } from './Pipe';
import { IndexesAny, SchemaAny, TableResolved } from './Schema';
import { Select } from './Select';
import { join, notNil, PRIV, sqlQuote, traverserFromRowIterator } from './Utils';
import { DataFromValues, serializeValues, ValuesAny } from './Values';
import { serializeColumn } from './Column';
import DB from 'better-sqlite3';

type QueriesCache = {
  insert: DB.Statement | null;
  deleteByKey: DB.Statement | null;
  updateByKey: DB.Statement | null;
  selectAll: DB.Statement | null;
  findByKey: DB.Statement | null;
};

export type DatabaseTableAny = DatabaseTable<string | number | symbol, any, any, IndexesAny<any>>;

export class DatabaseTable<
  Name extends string | number | symbol,
  Key,
  Data,
  Indexes extends IndexesAny<Data>
> {
  readonly name: Name;
  readonly schema: SchemaAny;
  readonly [PRIV]: { close: () => void };

  private readonly getDb: () => DB.Database;
  private readonly tableConfig: TableResolved;
  private readonly pipeParent: PipeParent<Key>;

  private readonly cache: QueriesCache = {
    insert: null,
    deleteByKey: null,
    updateByKey: null,
    selectAll: null,
    findByKey: null,
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
    this[PRIV] = {
      close: this.close.bind(this),
    };
  }

  private close() {
    // Object.entries(this.cache).forEach(([name, stmt]) => {
    //   if (stmt !== null) {
    //     stmt.finalize();
    //     (this.cache as any)[name] = null;
    //   }
    // });
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
      const query = join.space(`DELETE FROM ${sqlQuote(this.name)}`, `WHERE`, `key = ?`);
      return db.prepare(query);
    });
  }

  private getUpdateByKeyQuery(): DB.Statement {
    return this.getStatement('updateByKey', (): DB.Statement => {
      const db = this.getDb();
      const query = join.space(
        `UPDATE ${sqlQuote(this.name)}`,
        `SET`,
        join.comma(
          `key = :key`, // key
          `data = :data`,
          // rest is indexes
          ...this.tableConfig.indexes.map((index) => `${sqlQuote(index.name)} = :${index.name}`)
        ),
        `WHERE`,
        `key = :internal_current_key`
      );
      return db.prepare(query);
    });
  }

  private getInsertQuery(): DB.Statement {
    return this.getStatement('insert', (): DB.Statement => {
      const db = this.getDb();
      const query = join.space(
        `INSERT INTO ${sqlQuote(this.name)}`,
        `(`,
        join.comma('key', 'data', ...this.tableConfig.indexes.map((index) => sqlQuote(index.name))),
        `)`,
        `VALUES`,
        `(`,
        join.comma(
          `?`, // key
          `?`, // data
          // rest is indexes
          ...this.tableConfig.indexes.map(() => `?`) // indexes
        ),
        `)`
      );
      return db.prepare(query);
    });
  }

  private getSelectAllQuery(): DB.Statement {
    return this.getStatement('selectAll', (): DB.Statement => {
      const db = this.getDb();
      const query = join.space(`SELECT key, data FROM ${sqlQuote(this.name)}`, `ORDER BY key ASC`);
      return db.prepare(query);
    });
  }

  private getFindByKeyQuery(): DB.Statement {
    return this.getStatement('findByKey', (): DB.Statement => {
      const db = this.getDb();
      const query = join.space(
        `SELECT key, data FROM ${sqlQuote(this.name)}`,
        `WHERE`,
        `key = ?`,
        `LIMIT 1`
      );
      return db.prepare(query);
    });
  }

  private prepareData(data: unknown): {
    key: Key;
    serailizedKey: any;
    data: string;
    indexes: Array<unknown>;
  } {
    const key = this.tableConfig.key.fn(data);
    const serailizedKey = serializeColumn(this.tableConfig.key.column, key, 'key');
    const indexes = this.tableConfig.indexes.map((index) => {
      return serializeColumn(index.column, index.fn(data), index.name);
    });
    const dataSer = JSON.stringify(this.schema.sanitize(data));
    return { key: key, serailizedKey, data: dataSer, indexes };
  }

  private deleteByKey(key: Key) {
    const serializedKey = serializeColumn(this.tableConfig.key.column, key, 'key');
    this.getDeleteByKeyQuery().run(serializedKey);
  }

  private insertInternal(data: unknown): { newKey: Key } {
    const params = this.prepareData(data);
    this.getInsertQuery().run(params.serailizedKey, params.data, ...params.indexes);
    return { newKey: params.key };
  }

  private updateByKey(key: Key, data: unknown): { updatedKey: Key } {
    const prepared = this.prepareData(data);
    const serializedKey = serializeColumn(this.tableConfig.key.column, key, 'key');
    const query = this.getUpdateByKeyQuery();
    const params: Record<string, unknown> = {
      internal_current_key: serializedKey,
      key: prepared.serailizedKey,
      data: prepared.data,
    };
    this.tableConfig.indexes.forEach((index, i) => {
      params[index.name] = prepared.indexes[i];
    });
    query.run(params as any);
    return { updatedKey: prepared.key };
  }

  private restore(data: string): Data {
    return this.schema.restore(JSON.parse(data)) as any;
  }

  insert(data: Data): PipeSingle<Key, Data, false> {
    const { newKey } = this.insertInternal(data);
    return new PipeSingle({ key: newKey, data }, this.pipeParent);
  }

  prepare(): Select<Name, Key, Data, Indexes, null>;
  prepare<Params extends ValuesAny>(params: Params): Select<Name, Key, Data, Indexes, Params>;
  prepare<Params extends ValuesAny>(
    params?: Params
  ): Select<Name, Key, Data, Indexes, Params | null> {
    return new Select({
      table: this.name,
      schema: this.schema,
      params: params ?? null,
      where: null,
      limit: null,
      orderBy: null,
    });
  }

  count(query: Select<Name, Key, Data, Indexes, null>): number;
  count<Params extends ValuesAny>(
    query: Select<Name, Key, Data, Indexes, Params>,
    params: DataFromValues<Params>
  ): number;
  count<Params extends ValuesAny | null>(
    query: Select<Name, Key, Data, Indexes, Params>,
    params?: Params extends ValuesAny ? DataFromValues<Params> : null
  ): number {
    const db = this.getDb();
    const preparedQuery = query[PRIV].getCountQuery(db);
    const paramsValues = query[PRIV].params;
    const paramsSerialized =
      paramsValues === null ? {} : serializeValues(paramsValues, params as any);
    return preparedQuery.get(paramsSerialized as any).count;
  }

  select(query: Select<Name, Key, Data, Indexes, null>): PipeCollection<Key, Data>;
  select<Params extends ValuesAny>(
    query: Select<Name, Key, Data, Indexes, Params>,
    params: DataFromValues<Params>
  ): PipeCollection<Key, Data>;
  select<Params extends ValuesAny | null>(
    query: Select<Name, Key, Data, Indexes, Params>,
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
    const serializedKey = serializeColumn(this.tableConfig.key.column, key, 'key');
    const entry = query.get(serializedKey);
    return new PipeSingle<Key, Data, true>(
      entry ? { key: entry.key as any, data: this.restore(entry.data as any) } : null,
      this.pipeParent
    );
  }
}
