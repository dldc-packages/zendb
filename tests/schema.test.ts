import { expect } from "@std/expect";
import { Column, Database, Schema } from "../mod.ts";

Deno.test("Init empty schema", () => {
  const db = Schema.declare({});
  expect(Database.schema(db.tables)).toEqual([]);
});

Deno.test("Init simple schema", () => {
  const schema = Schema.declare({
    users: ({ email: Column.text().primary(), username: Column.text() }),
  });

  const res = Database.schema(schema.tables);

  expect(res).toMatchObject([
    {
      kind: "CreateTable",
      params: null,
      sql:
        "CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL) STRICT",
    },
  ]);
});

Deno.test("Drop table", () => {
  const schema = Schema.declare({
    users: ({ email: Column.text().primary(), username: Column.text() }),
  });

  const res = schema.tables.users.schema.drop();

  expect(res).toMatchObject(
    {
      kind: "DropTable",
      sql: "DROP TABLE users",
      params: null,
    },
  );
});

Deno.test("Drop table if exist", () => {
  const schema = Schema.declare({
    users: ({ email: Column.text().primary(), username: Column.text() }),
  });

  const res = schema.tables.users.schema.drop({ ifExists: true });

  expect(res).toMatchObject(
    {
      kind: "DropTable",
      sql: "DROP TABLE IF EXISTS users",
      params: null,
    },
  );
});

Deno.test("Boolean column", () => {
  const schema = Schema.declare({
    settings: ({
      id: Column.text().primary(),
      isActive: Column.boolean(),
    }),
  });

  const res = Database.schema(schema.tables);

  expect(res).toMatchObject([
    {
      kind: "CreateTable",
      params: null,
      sql:
        "CREATE TABLE settings (id TEXT NOT NULL PRIMARY KEY, isActive INT NOT NULL) STRICT",
    },
  ]);
});

// test('Disable strict mode', () => {
//   const v1 = Schema.define({
//     strict: false,
//     tables: { users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text() }) },
//   });

//   const res = Database.create(v1).init();

//   expect(res).toMatchObject([
//     { kind: 'CreateTable', params: null, sql: 'CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL)' },
//   ]);
// });

// test('Should throw when no primary key is provided', () => {
//   const v1 = Schema.define({ tables: { users: Schema.table({ name: Schema.column.dt.text() }) } });
//   expect(() => Database.create(v1).init()).toThrow(/No primary key found/);
// });

// test('Should support multiple primary keys', () => {
//   const v1 = Schema.define({
//     tables: {
//       users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text().primary() }),
//     },
//   });

//   const res = Database.create(v1).init();

//   expect(res).toMatchObject([
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE users (email TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY (email, username)) STRICT',
//     },
//   ]);
// });

// test('Unique column', () => {
//   const v1 = Schema.define({
//     tables: {
//       users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text().unique() }),
//     },
//   });

//   const res = Database.create(v1).init();

//   expect(res).toMatchObject([
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL UNIQUE) STRICT',
//     },
//   ]);
// });

// test('Multi column unique constraint', () => {
//   const v1 = Schema.define({
//     tables: {
//       users: Schema.table({
//         id: Schema.column.dt.text().primary(),
//         username: Schema.column.dt.text().unique('unique_username_in_namespace'),
//         namespace: Schema.column.dt.text().unique('unique_username_in_namespace'),
//       }),
//     },
//   });

//   const res = Database.create(v1).init();

//   expect(res).toMatchObject([
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL, namespace TEXT NOT NULL, CONSTRAINT unique_username_in_namespace UNIQUE (username, namespace)) STRICT',
//     },
//   ]);
// });

// test('All datatype', () => {
//   const res = Database.create(allDatatypesSchema).init();

//   expect(res).toMatchObject([
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE datatype (id TEXT NOT NULL PRIMARY KEY, text TEXT NOT NULL, integer INTEGER NOT NULL, boolean INTEGER NOT NULL, date REAL NOT NULL, json TEXT NOT NULL, number REAL NOT NULL) STRICT',
//     },
//   ]);
// });

// test('Nullable column', () => {
//   const v1 = Schema.define({
//     tables: { users: Schema.table({ id: Schema.column.dt.text().primary(), comment: Schema.column.dt.text().nullable() }) },
//   });

//   const res = Database.create(v1).init();

//   expect(res).toMatchObject([
//     { kind: 'CreateTable', params: null, sql: 'CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, comment TEXT) STRICT' },
//   ]);
// });

// test('Init tasksSchema', () => {
//   const res = Database.create(tasksSchema).init();

//   expect(res).toMatchObject([
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE tasks (id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, completed INTEGER NOT NULL) STRICT',
//     },
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL) STRICT',
//     },
//     {
//       kind: 'CreateTable',
//       params: null,
//       sql: 'CREATE TABLE users_tasks (user_id TEXT NOT NULL, task_id TEXT NOT NULL, PRIMARY KEY (user_id, task_id)) STRICT',
//     },
//   ]);
// });
