import { Schema } from '../src/mod';
import { allDatatypesSchema } from './utils/allDatatypesSchema';
import { tasksSchema } from './utils/tasksSchema';

test('Init empty schema', () => {
  const v1 = Schema.create({ tables: {} });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([]);
});

test('Init simple schema', () => {
  const v1 = Schema.create({
    tables: { users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text() }) },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL) STRICT`]);
});

test('Disable strict mode', () => {
  const v1 = Schema.create({
    strict: false,
    tables: { users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text() }) },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL)`]);
});

test('Should throw when no primary key is provided', () => {
  const v1 = Schema.create({ tables: { users: Schema.table({ name: Schema.column.dt.text() }) } });
  expect(() => Schema.schemaToCreateTableQueries(v1)).toThrow(/No primary key found/);
});

test('Should support multiple primary keys', () => {
  const v1 = Schema.create({
    tables: {
      users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text().primary() }),
    },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([`CREATE TABLE users (email TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY (email, username)) STRICT`]);
});

test('Unique column', () => {
  const v1 = Schema.create({
    tables: {
      users: Schema.table({ email: Schema.column.dt.text().primary(), username: Schema.column.dt.text().unique() }),
    },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL UNIQUE) STRICT`]);
});

test('Multi column unique constraint', () => {
  const v1 = Schema.create({
    tables: {
      users: Schema.table({
        id: Schema.column.dt.text().primary(),
        username: Schema.column.dt.text().unique('unique_username_in_namespace'),
        namespace: Schema.column.dt.text().unique('unique_username_in_namespace'),
      }),
    },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([
    `CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL, namespace TEXT NOT NULL, CONSTRAINT unique_username_in_namespace UNIQUE (username, namespace)) STRICT`,
  ]);
});

test('All datatype', () => {
  const res = Schema.schemaToCreateTableQueries(allDatatypesSchema);

  expect(res).toEqual([
    `CREATE TABLE datatype (id TEXT NOT NULL PRIMARY KEY, text TEXT NOT NULL, integer INTEGER NOT NULL, boolean INTEGER NOT NULL, date REAL NOT NULL, json TEXT NOT NULL, number REAL NOT NULL) STRICT`,
  ]);
});

test('Nullable column', () => {
  const v1 = Schema.create({
    tables: { users: Schema.table({ id: Schema.column.dt.text().primary(), comment: Schema.column.dt.text().nullable() }) },
  });

  const res = Schema.schemaToCreateTableQueries(v1);

  expect(res).toEqual([`CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, comment TEXT) STRICT`]);
});

test('Init tasksSchema', () => {
  const res = Schema.schemaToCreateTableQueries(tasksSchema);

  expect(res).toEqual([
    `CREATE TABLE tasks (id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, completed INTEGER NOT NULL) STRICT`,
    `CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL) STRICT`,
    `CREATE TABLE users_tasks (user_id TEXT NOT NULL, task_id TEXT NOT NULL, PRIMARY KEY (user_id, task_id)) STRICT`,
  ]);
});
