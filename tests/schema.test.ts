import * as zen from '../src/mod';
import { allDatatypesSchema } from './utils/allDatatypesSchema';
import { MockDiver, MockDriverDatabase } from './utils/MockDriver';
import { tasksSchema } from './utils/tasksSchema';

let driver: MockDiver = new MockDiver();
let database: MockDriverDatabase = driver.openMain();

beforeEach(() => {
  driver = new MockDiver();
  database = driver.openMain();
});

test('Init empty schema', () => {
  const v1 = zen.schema({ tables: {} });

  const db = new zen.Database(database, v1, 0);
  expect(db.fingerpring).toBe(0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).not.toHaveBeenCalled();
});

test('Init simple schema', () => {
  const v1 = zen.schema({ tables: { users: zen.table({ email: zen.column.text().primary(), username: zen.column.text() }) } });

  const db = new zen.Database(database, v1, 0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL) STRICT`);
});

test('Throw if database is not empty', () => {
  const v1 = zen.schema({ tables: { users: zen.table({ email: zen.column.text().primary(), username: zen.column.text() }) } });

  const db = new zen.Database(database, v1, 0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([{ name: 'some-table' }]);
  expect(() => db.initSchema()).toThrow('Cannot init schema on non-empty database');
});

test('Disable strict mode', () => {
  const v1 = zen.schema({
    strict: false,
    tables: { users: zen.table({ email: zen.column.text().primary(), username: zen.column.text() }) },
  });

  const db = new zen.Database(database, v1, 0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL)`);
});

test('Should throw when no primary key is provided', () => {
  const v1 = zen.schema({ tables: { users: zen.table({ name: zen.column.text() }) } });
  expect(() => {
    new zen.Database(database, v1, 0);
  }).toThrow(/No primary key found/);
});

test('Should support multiple primary keys', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({ email: zen.column.text().primary(), username: zen.column.text().primary() }),
    },
  });

  const db = new zen.Database(database, v1, 0);
  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(
    `CREATE TABLE users (email TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY (email, username)) STRICT`
  );
});

test('Unique column', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({ email: zen.column.text().primary(), username: zen.column.text().unique() }),
    },
  });

  const db = new zen.Database(database, v1, 0);
  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(`CREATE TABLE users (email TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL UNIQUE) STRICT`);
});

test('Multi column unique constraint', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({
        id: zen.column.text().primary(),
        username: zen.column.text().unique('unique_username_in_namespace'),
        namespace: zen.column.text().unique('unique_username_in_namespace'),
      }),
    },
  });

  const db = new zen.Database(database, v1, 0);
  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(
    `CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, username TEXT NOT NULL, namespace TEXT NOT NULL, CONSTRAINT unique_username_in_namespace UNIQUE (username, namespace)) STRICT`
  );
});

test('All datatype', () => {
  const db = new zen.Database(database, allDatatypesSchema, 0);
  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(
    `CREATE TABLE datatype (id TEXT NOT NULL PRIMARY KEY, text TEXT NOT NULL, integer INTEGER NOT NULL, boolean INTEGER NOT NULL, date REAL NOT NULL, json TEXT NOT NULL, number REAL NOT NULL) STRICT`
  );
});

test('Nullable column', () => {
  const v1 = zen.schema({
    tables: { users: zen.table({ id: zen.column.text().primary(), comment: zen.column.text().nullable() }) },
  });

  const db = new zen.Database(database, v1, 0);
  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledWith(`CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, comment TEXT) STRICT`);
});

test('Init tasksSchema', () => {
  const db = new zen.Database(database, tasksSchema, 0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  expect(stmt.all).toHaveBeenCalledTimes(1);
  expect(database.exec).toHaveBeenCalledTimes(3);
  expect(database.exec.mock.calls).toEqual([
    [
      'CREATE TABLE tasks (id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, completed INTEGER NOT NULL) STRICT',
    ],
    ['CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL) STRICT'],
    ['CREATE TABLE users_tasks (user_id TEXT NOT NULL, task_id TEXT NOT NULL, PRIMARY KEY (user_id, task_id)) STRICT'],
  ]);
});
