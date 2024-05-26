export interface IDeleteOperation {
  kind: "Delete";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { deleted: number }) => { deleted: number };
}

export interface IUpdateOperation {
  kind: "Update";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { updated: number }) => { updated: number };
}

export interface IInsertOperation<Inserted> {
  kind: "Insert";
  sql: string;
  params: Record<string, any> | null;
  parse: () => Inserted;
}

export interface IInsertManyOperation<Inserted> {
  kind: "InsertMany";
  sql: string;
  params: Record<string, any> | null;
  parse: () => Inserted[];
}

export interface IQueryOperation<Result> {
  kind: "Query";
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: Array<Record<string, any>>) => Result;
}

export interface ICreateTableOperation {
  kind: "CreateTable";
  sql: string;
  params: null;
  parse: () => null;
}

export interface IListTablesOperation {
  kind: "ListTables";
  sql: string;
  params: null;
  parse: (raw: Array<Record<string, any>>) => Array<string>;
}

export interface IPragmaOperation<Value> {
  kind: "Pragma";
  sql: string;
  params: null;
  parse: (raw: Array<Record<string, any>>) => Value;
}

export interface IPragmaSetOperation {
  kind: "PragmaSet";
  sql: string;
  params: null;
  parse: () => null;
}

export type IOperation =
  | IDeleteOperation
  | IUpdateOperation
  | IInsertOperation<any>
  | IInsertManyOperation<any>
  | IQueryOperation<any>
  | ICreateTableOperation
  | IListTablesOperation
  | IPragmaOperation<any>
  | IPragmaSetOperation;

export type IOperationKind = IOperation["kind"];

export type IOperationResult<T extends IOperation> = T extends IDeleteOperation
  ? { deleted: number }
  : T extends IUpdateOperation ? { updated: number }
  : T extends IInsertOperation<infer Inserted> ? Inserted
  : T extends IInsertManyOperation<infer Inserted> ? Inserted[]
  : T extends IQueryOperation<infer Result> ? Result
  : T extends ICreateTableOperation ? null
  : T extends IListTablesOperation ? Array<string>
  : T extends IPragmaOperation<infer Value> ? Value
  : T extends IPragmaSetOperation ? null
  : never;
