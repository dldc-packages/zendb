import { Ast, builder as b, printNode } from "@dldc/sqlite";
import type {
  ICreateTableOperation,
  IListTablesOperation,
  IPragmaOperation,
  IPragmaSetOperation,
} from "./Operation.ts";
import type { ITableSchemaOptions, TTable } from "./Table.ts";

export function schema<Tables extends Record<string, TTable<any, any>>>(
  tables: Tables,
  options?: ITableSchemaOptions,
): Array<ICreateTableOperation> {
  return Object.values(tables).map((table) => table.schema(options));
}

export function tables(): IListTablesOperation {
  const query = b.SelectStmt.build({
    resultColumns: [b.ResultColumn.column("name")],
    from: b.SelectStmt.FromTable("sqlite_master"),
    where: b.Operations.equal(
      b.Expr.column("type"),
      b.Literal.literal("table"),
    ),
  });
  return {
    kind: "ListTables",
    sql: printNode(query),
    params: null,
    parse: (raw) => raw.map((row) => row.name),
  };
}

export function userVersion(): IPragmaOperation<number> {
  const query = Ast.createNode("PragmaStmt", {
    pragmaName: b.Expr.identifier("user_version"),
  });
  return {
    kind: "Pragma",
    sql: printNode(query),
    params: null,
    parse: (raw) => raw[0].user_version,
  };
}

export function setUserVersion(version: number): IPragmaSetOperation {
  const query = Ast.createNode("PragmaStmt", {
    pragmaName: b.Expr.identifier("user_version"),
    value: {
      variant: "Equal",
      pragmaValue: b.Literal.string(version.toString()),
    },
  });
  return {
    kind: "PragmaSet",
    sql: printNode(query),
    params: null,
    parse: () => null,
  };
}
