import { DatabaseTableQuery, ExtractTable, WhereBase } from './DatabaseTableQuery';
import {
  Infer,
  InferSchemaTableInput,
  SchemaAny,
  SchemaColumnAny,
  SchemaTableAny,
  serializeColumn,
} from './schema';
import { PRIV } from './Utils';
import { builder as b, printNode } from 'zensqlite';
import { createSetItems, createWhere, paramsFromMap } from './QueryUtils';

export type Statement = { query: string; params: Record<string, any> | null };

export type DatabaseTableAny = DatabaseTable<SchemaAny, string, SchemaTableAny>;

export type DeleteOptions = { limit?: number };

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

  constructor(schema: Schema, name: TableName) {
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
    return DatabaseTableQuery.create<Schema, TableName>(this.schema, this.name);
  }

  insert(data: InferSchemaTableInput<SchemaTable>): Statement {
    const resolvedData: Record<string, any> = {};
    this.columns.forEach(([name, column]) => {
      const input = (data as any)[name];
      resolvedData[name] = serializeColumn(column, input);
    });
    const columnsArgs = this.columns.map(([name]) => resolvedData[name]);
    const params = this.columns.map(() => b.Expr.BindParameter.Indexed());
    const columns = this.columns.map(([col]) => b.Identifier(col));
    const insertNode = b.InsertStmt(this.name as string, {
      columnNames: columns,
      data: b.InsertStmtData.Values([params]),
    });
    return { query: printNode(insertNode), params: columnsArgs };
  }

  delete(condition: WhereBase<SchemaTable>, options: DeleteOptions = {}): Statement {
    const paramsMap = new Map<any, string>();
    const tableName = this.name as string;
    const queryNode = b.DeleteStmt(tableName, {
      where: createWhere(paramsMap, this.schemaTable, condition, tableName),
      limit: options.limit,
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { query: queryText, params };
  }

  deleteOne(condition: WhereBase<SchemaTable>): Statement {
    return this.delete(condition, { limit: 1 });
  }

  update(
    data: Partial<Infer<SchemaTable>>,
    { where, limit }: UpdateOptions<SchemaTable> = {}
  ): Statement {
    const paramsMap = new Map<any, string>();
    const tableName = this.name as string;
    const table = this.schemaTable;
    const queryNode = b.UpdateStmt(tableName, {
      where: where ? createWhere(paramsMap, table, where, tableName) : undefined,
      limit: limit,
      setItems: createSetItems(paramsMap, table, data),
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { query: queryText, params };
  }

  updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): Statement {
    return this.update(data, { where, limit: 1 });
  }
}
