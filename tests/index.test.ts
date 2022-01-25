import { Database, schema, Migrations, sql, value } from '../src';
import fse from 'fs-extra';
import { nanoid } from 'nanoid';
import { resolve } from 'path';
import mockConsole, { RestoreConsole } from 'jest-mock-console';

function tempFile(suffix: string): string {
  return resolve('tests/tmp', nanoid() + suffix);
}

let restoreConsole: null | RestoreConsole = null;

beforeEach(() => {
  fse.ensureDir('tests/tmp');
  restoreConsole = mockConsole(['log', 'warn', 'error', 'info']);
});

afterEach(() => {
  if (restoreConsole) {
    restoreConsole();
  }
  fse.emptyDir('tests/tmp');
});

test('Run database', () => {
  const v1 = schema.create({
    tables: {},
  });

  const db = new Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(db.tables).toEqual({});
});

test('Run database with tables', () => {
  const v1 = schema.create({
    tables: {
      users: schema
        .table<{ id: string; name: string }>()
        .key(schema.column.text(), (user) => user.id)
        .index('name', schema.column.text(), (user) => user.name),
    },
  });

  const db = new Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(Object.keys(db.tables)).toEqual(['users']);
});

test('Run migration', () => {
  const v1 = schema.create({
    tables: {
      users: schema
        .table<{ id: string; name: string }>()
        .key(schema.column.text(), (user) => user.id)
        .index('name', schema.column.text(), (user) => user.name),
    },
  });

  const migrations = Migrations.create({
    id: 'init',
    description: 'Initial migration',
    schema: v1,
    migrate: (_, db) => {
      db.tables.users.insert({ id: '1', name: 'John' });
      db.tables.users.insert({ id: '2', name: 'Paul' });
      db.tables.users.insert({ id: '3', name: 'John' });
      db.tables.users.insert({ id: '4', name: 'Pierre' });
    },
  });

  const db = migrations.applySync({
    databasePath: tempFile('_data.db'),
    migrationDatabasePath: tempFile('_data-migration.db'),
  });

  expect((console.log as jest.Mock).mock.calls).toEqual([
    ['1 migrations to apply'],
    ['Running migration init "Initial migration" (INIT -> 242)'],
    ['-> CREATE TABLE `users`(key TEXT PRIMARY KEY NOT NULL, data JSON, `name` TEXT NOT NULL);'],
  ]);

  expect(db.tables.users.all().valuesArray()).toEqual([
    { id: '1', name: 'John' },
    { id: '2', name: 'Paul' },
    { id: '3', name: 'John' },
    { id: '4', name: 'Pierre' },
  ]);

  const findJohns = db.tables.users
    .prepare()
    .where(({ indexes }) => sql.eq(indexes.name, sql.literal('John')));

  expect(db.tables.users.select(findJohns).valuesArray()).toEqual([
    { id: '1', name: 'John' },
    { id: '3', name: 'John' },
  ]);

  expect(db.tables.users.count(findJohns)).toEqual(2);

  const findByName = db.tables.users
    .prepare({ name: value.text() })
    .where(({ indexes, params }) => sql.eq(indexes.name, params.name));

  expect(db.tables.users.select(findByName, { name: 'Paul' }).keysArray()).toEqual(['2']);
});
