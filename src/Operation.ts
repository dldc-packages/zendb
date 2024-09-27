export interface TDeleteOperation {
  kind: "Delete";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { deleted: number }) => { deleted: number };
}

export interface TUpdateOperation {
  kind: "Update";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { updated: number }) => { updated: number };
}

export interface TInsertOperation<Inserted> {
  kind: "Insert";
  sql: string;
  params: Record<string, any> | null;
  parse: () => Inserted;
}

export interface TInsertManyOperation<Inserted> {
  kind: "InsertMany";
  sql: string;
  params: Record<string, any> | null;
  parse: () => Inserted[];
}

export interface TQueryOperation<Result> {
  kind: "Query";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: Array<Record<string, any>>) => Result;
}

export interface TCreateTableOperation {
  kind: "CreateTable";
  sql: string;
  params: null;
  parse: () => null;
}

export interface TDropTableOperation {
  kind: "DropTable";
  sql: string;
  params: null;
  parse: () => null;
}

export interface TListTablesOperation {
  kind: "ListTables";
  sql: string;
  params: null;
  parse: (raw: Array<Record<string, any>>) => Array<string>;
}

export interface TPragmaOperation<Value> {
  kind: "Pragma";
  sql: string;
  params: null;
  parse: (raw: Array<Record<string, any>>) => Value;
}

export interface TPragmaSetOperation {
  kind: "PragmaSet";
  sql: string;
  params: null;
  parse: () => null;
}

export type TOperation =
  | TDeleteOperation
  | TUpdateOperation
  | TInsertOperation<any>
  | TInsertManyOperation<any>
  | TQueryOperation<any>
  | TCreateTableOperation
  | TDropTableOperation
  | TListTablesOperation
  | TPragmaOperation<any>
  | TPragmaSetOperation;

export type TOperationKind = TOperation["kind"];

export type TOperationResult<T extends TOperation> = T extends TDeleteOperation
  ? { deleted: number }
  : T extends TUpdateOperation ? { updated: number }
  : T extends TInsertOperation<infer Inserted> ? Inserted
  : T extends TInsertManyOperation<infer Inserted> ? Inserted[]
  : T extends TQueryOperation<infer Result> ? Result
  : T extends TCreateTableOperation ? null
  : T extends TDropTableOperation ? null
  : T extends TListTablesOperation ? Array<string>
  : T extends TPragmaOperation<infer Value> ? Value
  : T extends TPragmaSetOperation ? null
  : never;
