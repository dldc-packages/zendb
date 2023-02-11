import { Expr, Random, Table } from '../src/mod';
import { allDatatypesDb } from './utils/allDatatypesDb';
import { format, sql } from './utils/sql';
import { tasksDb } from './utils/tasksDb';

let nextRandomId = 0;

beforeAll(() => {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
});

beforeEach(() => {
  nextRandomId = 0;
});

test('Insert', () => {
  const result = tasksDb.users.insert({ id: '1', name: 'John Doe', email: 'john@exemple.com' });
  expect(result).toMatchObject({
    kind: 'Insert',
    params: {
      email_id2: 'john@exemple.com',
      id_id0: '1',
      name_id1: 'John Doe',
    },
  });
  expect(result.parse()).toEqual({ email: 'john@exemple.com', id: '1', name: 'John Doe' });
  expect(format(result.sql)).toEqual(sql`
    INSERT INTO users (id, name, email)
    VALUES (:id_id0, :name_id1, :email_id2)
  `);
});

test('Delete', () => {
  const result = tasksDb.users.delete((cols) => Expr.equal(cols.id, Expr.literal('1')));
  expect(result).toMatchObject({ kind: 'Delete', params: null });
  expect(format(result.sql)).toEqual(sql`DELETE FROM users WHERE users.id == '1'`);
});

test('Delete with external value', () => {
  const result = tasksDb.users.delete((cols) => Expr.equal(cols.id, Expr.external('1', 'delete_id')));
  expect(result).toMatchObject({
    kind: 'Delete',
    params: { delete_id_id0: '1' },
  });
  expect(format(result.sql)).toEqual(sql`DELETE FROM users WHERE users.id == :delete_id_id0`);
});

test('Delete One', () => {
  const result = tasksDb.users.deleteOne((cols) => Expr.equal(cols.id, Expr.literal('1')));
  expect(result).toMatchObject({ kind: 'Delete', params: null });
  expect(format(result.sql)).toEqual(sql`DELETE FROM users WHERE users.id == '1' LIMIT 1`);
});

test('Update', () => {
  const result = tasksDb.users.update({ name: 'Paul' }, { where: (cols) => Expr.equal(cols.id, Expr.literal('1234')) });
  expect(result).toMatchObject({
    kind: 'Update',
    params: { name_id0: 'Paul' },
  });
  expect(format(result.sql)).toEqual(sql`UPDATE users SET name = :name_id0 WHERE users.id == '1234'`);
});

test('Update with external', () => {
  const result = tasksDb.users.update({ name: 'Paul' }, { where: (cols) => Expr.equal(cols.id, Expr.external('1234', 'filter_id')) });
  expect(result).toMatchObject({
    kind: 'Update',
    params: { filter_id_id0: '1234', name_id1: 'Paul' },
  });
  expect(format(result.sql)).toEqual(sql`UPDATE users SET name = :name_id1 WHERE users.id == :filter_id_id0`);
});

test('Update One', () => {
  const result = tasksDb.users.updateOne({ name: 'Paul' }, (cols) => Expr.equal(cols.id, Expr.literal('1234')));
  expect(result).toMatchObject({
    kind: 'Update',
    params: { name_id0: 'Paul' },
  });
  expect(format(result.sql)).toEqual(sql`UPDATE users SET name = :name_id0 WHERE users.id == '1234' LIMIT 1`);
});

test('Query', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .all();
  expect(format(result.sql)).toEqual(sql`SELECT users.id AS id, users.email AS email FROM users`);
  expect(result.params).toEqual(null);
});

test('Query select twice (override)', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .select((cols) => {
      return { idEmail: Expr.concatenate(cols.id, cols.email) };
    })
    .all();
  expect(format(result.sql)).toEqual(sql`
    SELECT users.id || users.email AS idEmail
    FROM users
  `);
  expect(result.params).toEqual(null);
});

test(`Query groupBy`, () => {
  const result = tasksDb.users
    .query()
    .groupBy((cols) => [cols.email])
    .select((cols) => ({ count: Expr.AggregateFunctions.count(cols.id) }))
    .all();
  expect(format(result.sql)).toEqual(sql`SELECT count(users.id) AS count FROM users GROUP BY users.email`);
  expect(result.params).toEqual(null);
});

test(`Query groupBy reverse order (same result)`, () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ count: Expr.AggregateFunctions.count(cols.id) }))
    .groupBy((cols) => [cols.email])
    .all();
  expect(format(result.sql)).toEqual(sql`SELECT count(users.id) AS count FROM users GROUP BY users.email`);
  expect(result.params).toEqual(null);
});

test('read and write datatypes', () => {
  const result = allDatatypesDb.datatype.insert({
    id: '1',
    text: 'test',
    boolean: true,
    date: new Date(2022, 8, 13, 15, 25, 12, 250),
    integer: 42,
    number: 3.14,
    json: { foo: 'bar', baz: true },
  });
  expect(result).toMatchObject({
    sql: 'INSERT INTO datatype (id, text, integer, boolean, date, json, number) VALUES (:id_id0, :text_id1, :integer_id2, :boolean_id3, :date_id4, :json_id5, :number_id6)',
    params: {
      boolean_id3: 1,
      date_id4: 1663075512250,
      id_id0: '1',
      integer_id2: 42,
      json_id5: '{"foo":"bar","baz":true}',
      number_id6: 3.14,
      text_id1: 'test',
    },
  });
  expect(result.parse()).toEqual({
    boolean: true,
    date: new Date('2022-09-13T13:25:12.250Z'),
    id: '1',
    integer: 42,
    json: { baz: true, foo: 'bar' },
    number: 3.14,
    text: 'test',
  });
});

test('Query simple CTE', () => {
  const query1 = tasksDb.users
    .query()
    .select((cols) => ({ demo: cols.id, id: cols.id }))
    .groupBy((cols) => [cols.name])
    .limit(Expr.literal(10));

  const result = Table.from(query1).all();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT users.id AS demo, users.id AS id
        FROM users
        GROUP BY users.name
        LIMIT 10
      )
    SELECT * FROM cte_id3
  `);
  expect(result.params).toEqual(null);
});

test('Query CTE', () => {
  const query1 = tasksDb.users
    .query()
    .select((cols) => ({ demo: cols.id, id: cols.id }))
    .groupBy((cols) => [cols.name])
    .limit(Expr.literal(10));

  const result = Table.from(query1)
    .select((cols) => ({ demo2: cols.demo, id: cols.id }))
    .where((cols) => Expr.equal(cols.id, Expr.literal(2)))
    .one();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT users.id AS demo, users.id AS id
        FROM users
        GROUP BY users.name
        LIMIT 10
      )
    SELECT cte_id3.demo AS demo2, cte_id3.id AS id
    FROM cte_id3
    WHERE cte_id3.id == 2
    LIMIT 1
  `);
  expect(result.params).toEqual(null);
});

test('Query add select column', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id }))
    .select((cols, current) => ({ ...current, email: cols.email }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT users.id AS id, users.email AS email
    FROM users
  `);
});

test('Query with json', () => {
  const result = tasksDb.users_tasks
    .query()
    .join(tasksDb.tasks.query(), 'tasks', (c) => Expr.equal(c.task_id, c.tasks.id))
    .select((c) => ({ userId: c.user_id, task: Expr.ScalarFunctions.json_object(c.tasks) }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      users_tasks.user_id AS userId,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS task
    FROM users_tasks
      LEFT JOIN tasks ON users_tasks.task_id == tasks.id
  `);
});

test('Query populate tasksIds', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id }))
    .populate(
      'taskIds',
      (c) => c.id,
      tasksDb.users_tasks.query(),
      (c) => c.user_id,
      (c) => c.task_id
    )
    .all();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id4 AS (
        SELECT
          users_tasks.user_id AS key,
          json_group_array(users_tasks.task_id) AS value
        FROM users_tasks
        GROUP BY users_tasks.user_id
      )
    SELECT
      users.id AS id,
      json_group_array(users_tasks.task_id) AS taskIds
    FROM users
      LEFT JOIN users_tasks ON users.id == users_tasks.user_id
  `);
});

test('Query populate', () => {
  const tasksWithUserId = tasksDb.users_tasks
    .query()
    .join(tasksDb.tasks.query(), 'tasks', (c) => Expr.equal(c.task_id, c.tasks.id))
    .select((c) => ({ userId: c.user_id, task: Expr.ScalarFunctions.json_object(c.tasks) }));

  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id }))
    .populate(
      'tasks',
      (c) => c.id,
      tasksWithUserId,
      (c) => c.userId,
      (c) => c.task
    )
    .all();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT
          users_tasks.user_id AS userId,
          json_object(
            'id', tasks.id,
            'title', tasks.title,
            'description', tasks.description,
            'completed', tasks.completed
          ) AS task
        FROM users_tasks
          LEFT JOIN tasks ON users_tasks.task_id == tasks.id
      ),
      cte_id8 AS (
        SELECT
          cte_id3.userId AS key,
          json_group_array(json(cte_id3.task)) AS value
        FROM cte_id3
        GROUP BY cte_id3.userId
      )
    SELECT
      users.id AS id,
      json_group_array(json(cte_id3.task)) AS tasks
    FROM
      users
      LEFT JOIN users_tasks ON users.id == cte_id3.userId
  `);
});
