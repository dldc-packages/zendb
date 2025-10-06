import { Ast, builder as b, printNode } from "@dldc/sqlite";
import type {
  TListTablesOperation,
  TPragmaOperation,
  TPragmaSetOperation,
} from "./Operation.ts";

/**
 * Creates an operation to list all table names in the database.
 *
 * @returns An operation that returns an array of table names
 *
 * @example
 * ```ts
 * const tableNames = driver.exec(db, Utils.listTables());
 * console.log(tableNames); // ["users", "tasks", "groups"]
 * ```
 */
export function listTables(): TListTablesOperation {
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

/**
 * Creates an operation to get the current database user_version.
 *
 * The user_version is used by the migration system to track which migrations
 * have been applied. Version 0 means no migrations have been applied.
 *
 * @returns An operation that returns the current user_version number
 *
 * @example
 * ```ts
 * const version = driver.exec(db, Utils.userVersion());
 * console.log(version); // 0 for new database, 1+ for migrated
 * ```
 */
export function userVersion(): TPragmaOperation<number> {
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

/**
 * Creates an operation to set the database user_version.
 *
 * This is typically used by the migration system to track applied migrations.
 * Use with caution - setting the wrong version can cause migration issues.
 *
 * @param version - The version number to set (must be non-negative)
 * @returns An operation that sets the user_version
 *
 * @example
 * ```ts
 * driver.exec(db, Utils.setUserVersion(3));
 * ```
 */
export function setUserVersion(version: number): TPragmaSetOperation {
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
