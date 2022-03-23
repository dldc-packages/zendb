import * as zen from '../src';
import fse from 'fs-extra';
import { nanoid } from 'nanoid';
import { resolve } from 'path';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { DatabaseTableQuery } from '../src/DatabaseTableQuery';

function tempFile(suffix: string): string {
  return resolve('tests/tmp', nanoid() + suffix);
}

function extractQuery(query: DatabaseTableQuery<any, any, any, any, any, any>): {
  query: string;
  params: Record<string, any> | null;
} {
  return (query as any).getQueryText();
}

let restoreConsole: null | RestoreConsole = null;

beforeEach(() => {
  fse.ensureDir('tests/tmp');
  restoreConsole = mockConsole(['log', 'warn', 'info']);
});

afterEach(() => {
  if (restoreConsole) {
    restoreConsole();
  }
  fse.emptyDir('tests/tmp');
});

test('Run database', () => {
  const v1 = zen.schema({
    tables: {},
  });

  const db = new zen.Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(db.tables).toEqual({});
});

test('Run database with tables', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({
        id: zen.column.text().primary(),
        slug: zen.column.text().unique(),
        name: zen.column.text(),
      }),
    },
  });

  const db = new zen.Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(Object.keys(db.tables)).toEqual(['users']);
});

test('Run migration', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({
        id: zen.column.text().primary(),
        slug: zen.column.text().unique(),
        name: zen.column.text(),
        createdAt: zen.column.date().defaultValue(() => new Date()),
      }),
    },
  });

  const migrations = zen.Migrations.create({
    id: 'init',
    description: 'Initial migration',
    schema: v1,
    migrate: (_, db) => {
      db.tables.users.insert({ id: '1', slug: 'john', name: 'John' });
      db.tables.users.insert({ id: '2', slug: 'paul', name: 'Paul' });
      db.tables.users.insert({ id: '3', slug: 'john-2', name: 'John' });
      db.tables.users.insert({ id: '4', slug: 'pierre', name: 'Pierre' });
    },
  });

  const db = migrations.applySync({
    databasePath: tempFile('_data.db'),
    migrationDatabasePath: tempFile('_data-migration.db'),
  });

  expect((console.info as jest.Mock).mock.calls).toEqual([
    ['1 migrations to apply'],
    ['Running migration init "Initial migration" (INIT -> 246)'],
    [
      '-> CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, createdAt REAL NOT NULL) STRICT',
    ],
  ]);

  const user1a = db.tables.users
    .query()
    .select({ id: true, name: true, slug: true })
    .where({ id: '1' })
    .one();
  expect(user1a).toEqual({ id: '1', slug: 'john', name: 'John' });

  const user1b = db.tables.users.query().select({ slug: true }).where({ id: '1' }).one();
  expect(user1b).toEqual({ slug: 'john' });

  expect(db.tables.users.query().select({ id: true, name: true }).all()).toEqual([
    { id: '1', name: 'John' },
    { id: '2', name: 'Paul' },
    { id: '3', name: 'John' },
    { id: '4', name: 'Pierre' },
  ]);

  const findJohns = db.tables.users
    .query()
    .where({ name: 'John' })
    .select({ id: true, name: true });

  expect(findJohns.all()).toEqual([
    { id: '1', name: 'John' },
    { id: '3', name: 'John' },
  ]);

  expect(extractQuery(findJohns)).toEqual({
    params: { name: 'John' },
    query: 'SELECT _0.id AS _0__id, _0.name AS _0__name FROM users AS _0 WHERE _0.name == :name',
  });

  expect(extractQuery(db.tables.users.query().where({ id: zen.Expr.lt('3') }))).toEqual({
    params: { id: '3' },
    query: 'SELECT _0.id AS _0__id FROM users AS _0 WHERE _0.id < :id',
  });

  expect(
    extractQuery(db.tables.users.query().where({ createdAt: zen.Expr.lt(new Date(2020, 1, 1)) }))
  ).toEqual({
    params: { createdAt: 1580511600000 },
    query: 'SELECT _0.id AS _0__id FROM users AS _0 WHERE _0.createdAt < :createdAt',
  });
});

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
