import DB from 'better-sqlite3';
import { DatabaseTableQuery, ExtractTable, WhereBase } from './DatabaseTableQuery';
import {
  Infer,
  InferSchemaTableInput,
  InferSchemaTableResult,
  SchemaAny,
  SchemaColumnAny,
  SchemaTableAny,
  serializeColumn,
} from './schema';
import { createWhere, paramsFromMap, PRIV } from './Utils';
import { builder as b, printNode } from 'zensqlite';

type QueriesCache = {
  insert: DB.Statement | null;
  //   deleteByKey: DB.Statement | null;
  //   updateByKey: DB.Statement | null;
  //   selectAll: DB.Statement | null;
  //   findByKey: DB.Statement | null;
  //   countAll: DB.Statement | null;
};

// type IndexQueriesCache<IndexName extends string> = { [K in IndexName]?: DB.Statement | undefined };

export type DatabaseTableAny = DatabaseTable<SchemaAny, string, SchemaTableAny>;

export type DeleteOptions = {
  limit?: number;
};

export type DeleteResult = {
  deleted: number;
};

export type UpdateOptions<SchemaTable extends SchemaTableAny> = {
  limit?: number;
  where?: WhereBase<SchemaTable>;
};

export class DatabaseTable<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny
> {
  readonly name: TableName;
  readonly schema: Schema;
  readonly schemaTable: SchemaTable;

  private readonly columns: Array<[string, SchemaColumnAny]>;
  private readonly getDb: () => DB.Database;
  // private readonly tableConfig: SchemaTableInternalAny;
  // private readonly pipeParent: PipeParent<Key>;
  // private readonly sqlTable: Table;

  private readonly cache: QueriesCache = {
    insert: null,
  };
  // private readonly indexQueriesCache: IndexQueriesCache<Indexes[number]['name']> = {};

  constructor(schema: Schema, name: TableName, getDb: () => DB.Database) {
    this.getDb = getDb;
    this.name = name;
    this.schema = schema;
    this.schemaTable = (schema.tables as any)[name];
    this.columns = Object.entries(this.schemaTable[PRIV].columns);
  }

  query(): DatabaseTableQuery<
    Schema,
    TableName,
    ExtractTable<Schema, TableName>,
    null,
    null,
    null
  > {
    return DatabaseTableQuery.create<Schema, TableName>(this.getDb, this.schema, this.name);
  }

  insert(data: InferSchemaTableInput<SchemaTable>): InferSchemaTableResult<SchemaTable> {
    const resolvedData: Record<string, any> = {};
    this.columns.forEach(([name, column]) => {
      const input = (data as any)[name];
      resolvedData[name] = serializeColumn(column, input);
    });
    const columnsArgs = this.columns.map(([name]) => resolvedData[name]);
    this.getInsertQuery().run(columnsArgs);
    return resolvedData as any;
  }

  delete(condition: WhereBase<SchemaTable>, options: DeleteOptions = {}): DeleteResult {
    const valuesParamsMap = new Map<any, string>();
    const tableName = this.name as string;
    const queryNode = b.DeleteStmt(tableName, {
      where: createWhere(valuesParamsMap, condition, tableName),
      limit: options.limit,
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(valuesParamsMap);
    const statement = this.getDb().prepare(queryText);
    if (params !== null) {
      statement.bind(params);
    }
    const result = statement.run();
    return { deleted: result.changes };
  }

  deleteOne(condition: WhereBase<SchemaTable>): DeleteResult {
    return this.delete(condition, { limit: 1 });
  }

  update(_options: UpdateOptions<SchemaTable>, _data: Partial<Infer<SchemaTable>>): void {
    throw new Error('Method not implemented.');
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

  private getInsertQuery(): DB.Statement {
    return this.getStatement('insert', (): DB.Statement => {
      const db = this.getDb();
      const params = this.columns.map(() => b.Expr.BindParameter.Indexed());
      const columns = this.columns.map(([col]) => b.Identifier(col));
      const queryNode = b.InsertStmt(this.name as string, {
        columnNames: columns,
        data: b.InsertStmtData.Values([params]),
      });
      return db.prepare(printNode(queryNode));
    });
  }

  // countAll(): number {
  //   const res = this.getCountAllQuery().get();
  //   return res.count;
  // }

  // count(query: PreparedQuery<Key, Data, Indexes, null>): number;
  // count<Params extends ValuesAny>(
  //   query: PreparedQuery<Key, Data, Indexes, Params>,
  //   params: ValuesParsed<Params>
  // ): number;
  // count<Params extends ValuesAny | null>(
  //   query: PreparedQuery<Key, Data, Indexes, Params>,
  //   params?: Params extends ValuesAny ? ValuesParsed<Params> : null
  // ): number {
  //   const db = this.getDb();
  //   const preparedQuery = query[PRIV].getCountQuery(db);
  //   const paramsValues = query[PRIV].params;
  //   const paramsSerialized =
  //     paramsValues === null ? {} : sql.Value.serializeValues(paramsValues, params as any);
  //   return preparedQuery.get(paramsSerialized as any).count;
  // }

  // select(query: PreparedQuery<Key, Data, Indexes, null>): PipeCollection<Key, Data>;
  // select<Params extends ValuesAny>(
  //   query: PreparedQuery<Key, Data, Indexes, Params>,
  //   params: ValuesParsed<Params>
  // ): PipeCollection<Key, Data>;
  // select<Params extends ValuesAny | null>(
  //   query: PreparedQuery<Key, Data, Indexes, Params>,
  //   params?: Params extends ValuesAny ? ValuesParsed<Params> : null
  // ): PipeCollection<Key, Data> {
  //   const db = this.getDb();
  //   const preparedQuery = query[PRIV].getSelectQuery(db);
  //   const paramsValues = query[PRIV].params;
  //   const paramsSerialized =
  //     paramsValues === null ? {} : sql.Value.serializeValues(paramsValues, params as any);
  //   const iter = preparedQuery.iterate(paramsSerialized as any);
  //   return new PipeCollection(
  //     traverserFromRowIterator<Key, string, Data>(iter, (data) => this.restore(data)),
  //     this.pipeParent
  //   );
  // }

  // findByIndex<IndexName extends Indexes[number]['name']>(
  //   index: IndexName,
  //   value: Extract<Indexes[number], { name: IndexName }>['_value']
  // ): PipeCollection<Key, Data> {
  //   const indexConfig = notNil(this.tableConfig.indexes.find((i) => i.name === index));
  //   const preparedQuery = this.getFindByIndexQuery(index);
  //   const valueSerialized = sql.Value.serialize(indexConfig.value, value, indexConfig.name);
  //   const iter = preparedQuery.iterate(valueSerialized);
  //   return new PipeCollection(
  //     traverserFromRowIterator<Key, string, Data>(iter, (data) => this.restore(data)),
  //     this.pipeParent
  //   );
  // }

  // all(): PipeCollection<Key, Data> {
  //   const iter = this.getSelectAllQuery().iterate();
  //   return new PipeCollection(
  //     traverserFromRowIterator<Key, string, Data>(iter, (data) => this.restore(data)),
  //     this.pipeParent
  //   );
  // }

  // findByKey(key: Key): PipeSingle<Key, Data, true> {
  //   const query = this.getFindByKeyQuery();
  //   const serializedKey = sql.Value.serialize(this.tableConfig.keyValue, key, 'key');
  //   const entry = query.get(serializedKey);
  //   return new PipeSingle<Key, Data, true>(
  //     entry ? { key: entry.key as any, data: this.restore(entry.data as any) } : null,
  //     this.pipeParent
  //   );
  // }
}
