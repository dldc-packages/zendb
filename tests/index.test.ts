import * as zen from '../src/mod';
import { MockDiver, MockDriverDatabase } from './MockDriver';

let driver: MockDiver = new MockDiver();
let database: MockDriverDatabase = driver.connect('/tmp/test');

beforeEach(() => {
  driver = new MockDiver();
  database = driver.connect('/tmp/test');
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

const tasksSchema = zen.schema({
  tables: {
    tasks: zen.table({
      id: zen.column.text().primary(),
      title: zen.column.text(),
      description: zen.column.text(),
      completed: zen.column.boolean(),
    }),
    users: zen.table({
      id: zen.column.text().primary(),
      name: zen.column.text(),
      email: zen.column.text(),
    }),
    users_tasks: zen.table({
      user_id: zen.column.text().primary(),
      task_id: zen.column.text().primary(),
    }),
  },
});

describe('Tasks Schema', () => {
  test('Init', () => {
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

  function initTasksDatabase() {
    const db = new zen.Database(database, tasksSchema, 0);

    const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    stmt.all.mockReturnValueOnce([]);
    db.initSchema();
    return db;
  }

  test('Insert', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`INSERT INTO users (id, name, email) VALUES (?, ?, ?)`);
    stmt.run.mockReturnValueOnce({ changes: 1 });
    const result = db.tables.users.insert({ id: '1', name: 'John Doe', email: 'john@exemple.com' });
    expect(result).toEqual({ id: '1', name: 'John Doe', email: 'john@exemple.com' });
  });

  test('Delete', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`DELETE FROM users WHERE users.id == :id`);
    stmt.run.mockReturnValueOnce({ changes: 4 });
    const result = db.tables.users.delete({ id: '1' });
    expect(result).toEqual({ deleted: 4 });
    expect(stmt.run).toHaveBeenCalledWith({ id: '1' });
    expect(stmt.run).toHaveBeenCalledTimes(1);
  });

  test('Delete One', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`DELETE FROM users WHERE users.id == :id LIMIT 1`);
    stmt.run.mockReturnValueOnce({ changes: 1 });
    const result = db.tables.users.deleteOne({ id: '1' });
    expect(result).toEqual({ deleted: 1 });
    expect(stmt.run).toHaveBeenCalledWith({ id: '1' });
    expect(stmt.run).toHaveBeenCalledTimes(1);
  });

  test('Update', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`UPDATE users SET name = :name WHERE users.id == :id`);
    stmt.run.mockReturnValueOnce({ changes: 3 });
    const result = db.tables.users.update({ name: 'Paul' }, { where: { id: '1234' } });
    expect(result).toEqual({ updated: 3 });
    expect(stmt.run).toHaveBeenCalledTimes(1);
  });

  test('Update One', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`UPDATE users SET name = :name WHERE users.id == :id LIMIT 1`);
    stmt.run.mockReturnValueOnce({ changes: 1 });
    const result = db.tables.users.updateOne({ name: 'Paul' }, { id: '1234' });
    expect(result).toEqual({ updated: 1 });
    expect(stmt.run).toHaveBeenCalledTimes(1);
  });

  test('Query', () => {
    const db = initTasksDatabase();

    const stmt = database.mockNextStatement(`SELECT _0.id AS _0__id, _0.email AS _0__email FROM users AS _0`);
    stmt.all.mockReturnValueOnce([
      { _0__id: '1', _0__email: 'etienne@gmail.com' },
      { _0__id: '2', _0__email: 'agathe@gmail.com' },
      { _0__id: '3', _0__email: 'paul@gmail.com' },
    ]);
    const result = db.tables.users.query().select({ id: true, email: true }).all();

    expect(result).toEqual([
      { id: '1', email: 'etienne@gmail.com' },
      { id: '2', email: 'agathe@gmail.com' },
      { id: '3', email: 'paul@gmail.com' },
    ]);
    expect(stmt.all).toHaveBeenCalledTimes(1);
  });
});

// test('Query', () => {
//   const db = new zen.Database(database, tasksSchema, 0);

//   const result = db.tables.users
//     .query()
//     .filter({ id: '1' })
//     .select({
//       name: true,
//     })
//     .joinOne('id', 'users_tasks', 'user_id')
//     .join('task_id', 'tasks', 'id')
//     .select({
//       id: true,
//       completed: true,
//       title: true,
//     })
//     .all();
// });

// test('Run migration', () => {
//   const v1 = zen.schema({
//     tables: {
//       users: zen.table({
//         id: zen.column.text().primary(),
//         slug: zen.column.text().unique(),
//         name: zen.column.text(),
//         createdAt: zen.column.date().defaultValue(() => new Date()),
//       }),
//     },
//   });

//   const migrations = zen.Migrations.create({
//     id: 'init',
//     description: 'Initial migration',
//     schema: v1,
//     migrate: (_, db) => {
//       db.tables.users.insert({ id: '1', slug: 'john', name: 'John' });
//       db.tables.users.insert({ id: '2', slug: 'paul', name: 'Paul' });
//       db.tables.users.insert({ id: '3', slug: 'john-2', name: 'John' });
//       db.tables.users.insert({ id: '4', slug: 'pierre', name: 'Pierre' });
//     },
//   });

//   const db = migrations.applySync({
//     databasePath: tempFile('_data.db'),
//     migrationDatabasePath: tempFile('_data-migration.db'),
//   });

//   expect((console.info as jest.Mock).mock.calls).toEqual([
//     ['Database current version: 0'],
//     ['1 migrations to apply'],
//     ['Running migration init "Initial migration" (INIT -> 246)'],
//     [
//       '-> CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, createdAt REAL NOT NULL) STRICT',
//     ],
//   ]);

//   const user1a = db.tables.users
//     .query()
//     .select({ id: true, name: true, slug: true })
//     .where({ id: '1' })
//     .one();
//   expect(user1a).toEqual({ id: '1', slug: 'john', name: 'John' });

//   const user1b = db.tables.users.query().select({ slug: true }).where({ id: '1' }).one();
//   expect(user1b).toEqual({ slug: 'john' });

//   expect(db.tables.users.query().select({ id: true, name: true }).all()).toEqual([
//     { id: '1', name: 'John' },
//     { id: '2', name: 'Paul' },
//     { id: '3', name: 'John' },
//     { id: '4', name: 'Pierre' },
//   ]);

//   const findJohns = db.tables.users
//     .query()
//     .where({ name: 'John' })
//     .select({ id: true, name: true });

//   expect(findJohns.all()).toEqual([
//     { id: '1', name: 'John' },
//     { id: '3', name: 'John' },
//   ]);

//   expect(extractQuery(findJohns)).toEqual({
//     params: { name: 'John' },
//     query: 'SELECT _0.id AS _0__id, _0.name AS _0__name FROM users AS _0 WHERE _0.name == :name',
//   });

//   expect(extractQuery(db.tables.users.query().where({ id: zen.Expr.lt('3') }))).toEqual({
//     params: { id: '3' },
//     query: 'SELECT _0.id AS _0__id FROM users AS _0 WHERE _0.id < :id',
//   });

//   expect(
//     extractQuery(db.tables.users.query().where({ createdAt: zen.Expr.lt(new Date(1580511600000)) }))
//   ).toEqual({
//     params: { createdAt: 1580511600000 },
//     query: 'SELECT _0.id AS _0__id FROM users AS _0 WHERE _0.createdAt < :createdAt',
//   });
// });

// test('Update key', () => {
//   const v1 = schema({
//     tables: {
//       users: table<{ id: string; name: string }>().key(sql.Value.text(), (user) => user.id),
//     },
//   });

//   const migrations = Migrations.create({
//     id: 'init',
//     description: 'Initial migration',
//     schema: v1,
//     migrate: (_, db) => {
//       db.tables.users.insert({ id: '1', name: 'John' });
//     },
//   });

//   const db = migrations.applySync({
//     databasePath: tempFile('_data.db'),
//     migrationDatabasePath: tempFile('_data-migration.db'),
//   });

//   expect(db.tables.users.findByKey('1').value()).toEqual({ id: '1', name: 'John' });

//   expect(
//     db.tables.users
//       .findByKey('1')
//       .update((prev) => ({ ...prev, name: 'Paul' }))
//       .value()
//   ).toEqual({
//     id: '1',
//     name: 'Paul',
//   });

//   expect(
//     db.tables.users
//       .findByKey('1')
//       .update((prev) => ({ ...prev, id: '2' }))
//       .value()
//   ).toEqual({
//     id: '2',
//     name: 'Paul',
//   });

//   expect(db.tables.users.findByKey('2').value()).toEqual({ id: '2', name: 'Paul' });

//   expect(db.tables.users.findByKey('2').delete().value()).toEqual({ id: '2', name: 'Paul' });

//   expect(db.tables.users.countAll()).toEqual(0);
// });

// test('list index', () => {
//   const v1 = schema({
//     tables: {
//       users: table<{ id: string; name: string; tags: Array<string> }>()
//         .key(sql.Value.text(), (user) => user.id)
//         .index('tags', sql.Value.list(z.string()), (user) => user.tags),
//     },
//   });

//   const migrations = Migrations.create({
//     id: 'init',
//     description: 'Initial migration',
//     schema: v1,
//     migrate: (_, db) => {
//       db.tables.users.insert({ id: '1', name: 'John', tags: ['foo', 'bar', 'baz'] });
//       db.tables.users.insert({ id: '2', name: 'John', tags: ['bar', 'baz'] });
//       db.tables.users.insert({ id: '3', name: 'John', tags: [] });
//       db.tables.users.insert({ id: '4', name: 'John', tags: ['foo', 'baz'] });
//     },
//   });

//   const db = migrations.applySync({
//     databasePath: tempFile('_data.db'),
//     migrationDatabasePath: tempFile('_data-migration.db'),
//   });

//   expect(db).toBeDefined();

//   const selectByTag = db.tables.users
//     .prepare({ tag: sql.Value.text() })
//     .where(({ indexes, params }) => sql.Expr.eq(indexes.tags, params.tag));

//   const result = db.tables.users.select(selectByTag, { tag: 'foo' }).valuesArray();
//   expect(result).toEqual([
//     { id: '1', name: 'John', tags: ['foo', 'bar', 'baz'] },
//     { id: '4', name: 'John', tags: ['foo', 'baz'] },
//   ]);

//   expect(db.tables.users.count(selectByTag, { tag: 'foo' })).toEqual(2);
//   expect(db.tables.users.count(selectByTag, { tag: 'baz' })).toEqual(3);
//   expect(db.tables.users.count(selectByTag, { tag: 'yolo' })).toEqual(0);
// });
