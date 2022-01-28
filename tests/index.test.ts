import { Database, schema, Migrations, sql, table } from '../src';
import fse from 'fs-extra';
import { nanoid } from 'nanoid';
import { resolve } from 'path';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import * as z from 'zod';

function tempFile(suffix: string): string {
  return resolve('tests/tmp', nanoid() + suffix);
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
  const v1 = schema({
    tables: {},
  });

  const db = new Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(db.tables).toEqual({});
});

test('Run database with tables', () => {
  const v1 = schema({
    tables: {
      users: table<{ id: string; name: string }>()
        .key(sql.Value.text(), (user) => user.id)
        .index('name', sql.Value.text(), (user) => user.name),
    },
  });

  const db = new Database(v1);
  db.connect(':memory:');
  expect(db.getUserVersion()).toBe(0);
  expect(Object.keys(db.tables)).toEqual(['users']);
});

test('Run migration', () => {
  const v1 = schema({
    tables: {
      users: table<{ id: string; name: string }>()
        .key(sql.Value.text(), (user) => user.id)
        .index('name', sql.Value.text(), (user) => user.name),
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

  expect(db.tables.users.findByKey('1').value()).toEqual({ id: '1', name: 'John' });

  expect(db.tables.users.all().valuesArray()).toEqual([
    { id: '1', name: 'John' },
    { id: '2', name: 'Paul' },
    { id: '3', name: 'John' },
    { id: '4', name: 'Pierre' },
  ]);

  const findJohns = db.tables.users
    .prepare()
    .where(({ indexes }) => sql.Expr.eq(indexes.name, sql.Expr.literal('John')));

  expect(db.tables.users.select(findJohns).valuesArray()).toEqual([
    { id: '1', name: 'John' },
    { id: '3', name: 'John' },
  ]);

  expect(db.tables.users.count(findJohns)).toEqual(2);

  const findByName = db.tables.users
    .prepare({ name: sql.Value.text() })
    .where(({ indexes, params }) => sql.Expr.eq(indexes.name, params.name));

  expect(db.tables.users.select(findByName, { name: 'Paul' }).keysArray()).toEqual(['2']);
});

test('Update key', () => {
  const v1 = schema({
    tables: {
      users: table<{ id: string; name: string }>().key(sql.Value.text(), (user) => user.id),
    },
  });

  const migrations = Migrations.create({
    id: 'init',
    description: 'Initial migration',
    schema: v1,
    migrate: (_, db) => {
      db.tables.users.insert({ id: '1', name: 'John' });
    },
  });

  const db = migrations.applySync({
    databasePath: tempFile('_data.db'),
    migrationDatabasePath: tempFile('_data-migration.db'),
  });

  expect(db.tables.users.findByKey('1').value()).toEqual({ id: '1', name: 'John' });

  expect(
    db.tables.users
      .findByKey('1')
      .update((prev) => ({ ...prev, name: 'Paul' }))
      .value()
  ).toEqual({
    id: '1',
    name: 'Paul',
  });

  expect(
    db.tables.users
      .findByKey('1')
      .update((prev) => ({ ...prev, id: '2' }))
      .value()
  ).toEqual({
    id: '2',
    name: 'Paul',
  });

  expect(db.tables.users.findByKey('2').value()).toEqual({ id: '2', name: 'Paul' });

  expect(db.tables.users.findByKey('2').delete().value()).toEqual({ id: '2', name: 'Paul' });

  expect(db.tables.users.countAll()).toEqual(0);
});

test('list index', () => {
  const v1 = schema({
    tables: {
      users: table<{ id: string; name: string; tags: Array<string> }>()
        .key(sql.Value.text(), (user) => user.id)
        .index('tags', sql.Value.list(z.string()), (user) => user.tags),
    },
  });

  const migrations = Migrations.create({
    id: 'init',
    description: 'Initial migration',
    schema: v1,
    migrate: (_, db) => {
      db.tables.users.insert({ id: '1', name: 'John', tags: ['foo', 'bar', 'baz'] });
      db.tables.users.insert({ id: '2', name: 'John', tags: ['bar', 'baz'] });
      db.tables.users.insert({ id: '3', name: 'John', tags: [] });
      db.tables.users.insert({ id: '4', name: 'John', tags: ['foo', 'baz'] });
    },
  });

  const db = migrations.applySync({
    databasePath: tempFile('_data.db'),
    migrationDatabasePath: tempFile('_data-migration.db'),
  });

  expect(db).toBeDefined();

  const selectByTag = db.tables.users
    .prepare({ tag: sql.Value.text() })
    .where(({ indexes, params }) => sql.Expr.eq(indexes.tags, params.tag));

  const result = db.tables.users.select(selectByTag, { tag: 'foo' }).valuesArray();
  expect(result).toEqual([
    { id: '1', name: 'John', tags: ['foo', 'bar', 'baz'] },
    { id: '4', name: 'John', tags: ['foo', 'baz'] },
  ]);

  expect(db.tables.users.count(selectByTag, { tag: 'foo' })).toEqual(2);
  expect(db.tables.users.count(selectByTag, { tag: 'baz' })).toEqual(3);
  expect(db.tables.users.count(selectByTag, { tag: 'yolo' })).toEqual(0);
});
