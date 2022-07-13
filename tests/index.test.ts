import * as zen from '../src/mod';

test('Base', () => {
  const v1 = zen.schema({ tables: {} });

  const db = new zen.Database(v1);
  expect(db.fingerpring).toBe(265);
  expect(db.createTableQueries).toEqual([]);
  expect(db.selectTablesQuery).toBe("SELECT name FROM sqlite_master WHERE type = 'table'");
});

test('Disble strict mode', () => {
  const v1 = zen.schema({
    strict: false,
    tables: {
      users: zen.table({
        email: zen.column.text().primary(),
        username: zen.column.text().primary(),
      }),
    },
  });

  const db = new zen.Database(v1);
  expect(db.createTableQueries).toEqual([
    'CREATE TABLE users (email TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY (email, username))',
  ]);
});

test('Should throw when no primary key is provided', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({ name: zen.column.text() }),
    },
  });
  expect(() => {
    new zen.Database(v1);
  }).toThrow(/No primary key found/);
});

test('Should support multiple primary keys', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({
        email: zen.column.text().primary(),
        username: zen.column.text().primary(),
      }),
    },
  });

  const db = new zen.Database(v1);
  expect(db.createTableQueries).toEqual([
    'CREATE TABLE users (email TEXT NOT NULL, username TEXT NOT NULL, PRIMARY KEY (email, username)) STRICT',
  ]);
});

test('Nullable column', () => {
  const v1 = zen.schema({
    tables: {
      users: zen.table({
        id: zen.column.text().primary(),
        comment: zen.column.text().nullable(),
      }),
    },
  });

  const db = new zen.Database(v1);
  expect(db.createTableQueries).toEqual([
    'CREATE TABLE users (id TEXT NOT NULL PRIMARY KEY, comment TEXT) STRICT',
  ]);
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

test('Insert', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.users.insert({
    id: '1',
    name: 'John Doe',
    email: 'john@exemple.com',
  });
  expect(statement).toEqual({
    params: ['1', 'John Doe', 'john@exemple.com'],
    query: 'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
  });
});

test('Delete', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.users.delete({ id: '1' });
  expect(statement).toEqual({
    query: 'DELETE FROM users WHERE users.id == :id',
    params: { id: '1' },
  });
});

test('Delete One', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.users.deleteOne({ id: '1' });
  expect(statement).toEqual({
    query: 'DELETE FROM users WHERE users.id == :id LIMIT 1',
    params: { id: '1' },
  });
});

test('Update', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.tasks.update({ description: '' }, { where: { id: '1' } });
  expect(statement).toEqual({
    query: 'UPDATE tasks SET description = :description WHERE tasks.id == :id',
    params: { description: '', id: '1' },
  });
});

test('Update One', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.tasks.updateOne({ description: '' }, { id: '1' });
  expect(statement).toEqual({
    query: 'UPDATE tasks SET description = :description WHERE tasks.id == :id LIMIT 1',
    params: { description: '', id: '1' },
  });
});

test('Query', () => {
  const db = new zen.Database(tasksSchema);

  const statement = db.tables.users
    .query()
    .filter({ id: '1' })
    .select({
      name: true,
    })
    .joinOne('id', 'users_tasks', 'user_id')
    .join('task_id', 'tasks', 'id')
    .select({
      id: true,
      completed: true,
      title: true,
    }).statement;
  expect(statement).toEqual({
    query:
      'SELECT _0.id AS _0__id, _0.completed AS _0__completed, _0.title AS _0__title, _1.* FROM (SELECT _1.user_id AS _1__user_id, _1.task_id AS _1__task_id, _2.* FROM (SELECT _2.name AS _2__name, _2.id AS _2__id FROM users AS _2 WHERE _2.id == :id) AS _2 LEFT JOIN users_tasks AS _1 ON _2__id == _1__user_id) AS _1 LEFT JOIN tasks AS _0 ON _1__task_id == _0__id',
    params: { id: '1' },
  });
});

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
