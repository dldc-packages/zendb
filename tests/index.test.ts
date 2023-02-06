import dedent from 'dedent';
import { format } from 'sql-formatter';
import { Expr, Random } from '../src/mod';
import { allDatatypesDb } from './utils/allDatatypesDb';
import { tasksDb } from './utils/tasksDb';

function formatSqlite(content: string) {
  return format(content, { language: 'sqlite' });
}

const sql = dedent;

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
    sql: 'INSERT INTO users (id, name, email) VALUES (:id_id0, :name_id1, :email_id2)',
    params: {
      email_id2: 'john@exemple.com',
      id_id0: '1',
      name_id1: 'John Doe',
    },
  });
  expect(result.parse()).toEqual({ email: 'john@exemple.com', id: '1', name: 'John Doe' });
});

test('Delete', () => {
  const result = tasksDb.users.delete((cols) => Expr.equal(cols.id, Expr.literal('1')));
  expect(result).toMatchObject({ kind: 'Delete', params: null, sql: "DELETE FROM users WHERE users.id == '1'" });
});

test('Delete with external value', () => {
  const result = tasksDb.users.delete((cols) => Expr.equal(cols.id, Expr.external('1', 'delete_id')));
  expect(result).toMatchObject({
    kind: 'Delete',
    params: { delete_id_id0: '1' },
    sql: 'DELETE FROM users WHERE users.id == :delete_id_id0',
  });
});

test('Delete One', () => {
  const result = tasksDb.users.deleteOne((cols) => Expr.equal(cols.id, Expr.literal('1')));
  expect(result).toMatchObject({ kind: 'Delete', params: null, sql: "DELETE FROM users WHERE users.id == '1' LIMIT 1" });
});

test('Update', () => {
  const result = tasksDb.users.update({ name: 'Paul' }, { where: (cols) => Expr.equal(cols.id, Expr.literal('1234')) });
  expect(result).toMatchObject({
    kind: 'Update',
    params: { name_id0: 'Paul' },
    sql: "UPDATE users SET name = :name_id0 WHERE users.id == '1234'",
  });
});

test('Update with external', () => {
  const result = tasksDb.users.update({ name: 'Paul' }, { where: (cols) => Expr.equal(cols.id, Expr.external('1234', 'filter_id')) });
  expect(result).toMatchObject({
    kind: 'Update',
    params: { filter_id_id0: '1234', name_id1: 'Paul' },
    sql: 'UPDATE users SET name = :name_id1 WHERE users.id == :filter_id_id0',
  });
});

test('Update One', () => {
  const result = tasksDb.users.updateOne({ name: 'Paul' }, (cols) => Expr.equal(cols.id, Expr.literal('1234')));
  expect(result).toMatchObject({
    kind: 'Update',
    params: { name_id0: 'Paul' },
    sql: "UPDATE users SET name = :name_id0 WHERE users.id == '1234' LIMIT 1",
  });
});

test('Query', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .all();
  expect(result.sql).toEqual(`SELECT users.id AS id, users.email AS email FROM users`);
  expect(result.params).toEqual(null);
});

test('Query select twice (cte)', () => {
  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .select((cols) => {
      return { idEmail: Expr.concatenate(cols.id, cols.email), ...cols };
    })
    .all();
  expect(formatSqlite(result.sql)).toEqual(sql`
    WITH
      cte_id1 AS (
        SELECT
          users.id AS id,
          users.email AS email
        FROM
          users
      )
    SELECT
      cte_id1.id || cte_id1.email AS idEmail,
      cte_id1.id AS id,
      cte_id1.email AS email
    FROM
      cte_id1
  `);
  expect(result.params).toEqual(null);
});

test('Query join', () => {
  const result = tasksDb.users
    .query()
    .select(({ id, email }) => ({ id, email }))
    .filter((c) => Expr.equal(c.id, Expr.literal('1')))
    .join(
      tasksDb.users_tasks.query(),
      (c, t) => Expr.equal(c.id, t.user_id),
      (l, r) => ({ ...l, ...r })
    )
    .all();

  expect(formatSqlite(result.sql)).toEqual(sql`
    WITH
      cte_id2 AS (
        SELECT
          users.id AS id,
          users.email AS email
        FROM
          users
        WHERE
          users.id == '1'
      ),
      cte_id3 AS (
        SELECT
          *
        FROM
          users_tasks
      )
    SELECT
      cte_id2.id AS id,
      cte_id2.email AS email,
      cte_id3.user_id AS user_id,
      cte_id3.task_id AS task_id
    FROM
      cte_id2
      LEFT JOIN cte_id3 ON cte_id2.id == cte_id3.user_id
  `);
  expect(result.params).toEqual(null);
});

test(`Query groupBy`, () => {
  const result = tasksDb.users
    .query()
    .groupBy((cols) => cols.email)
    .select((cols) => ({ count: Expr.AggregateFunctions.count(cols.id) }))
    .all();
  expect(result.sql).toEqual(`SELECT count(users.id) AS count FROM users GROUP BY users.email`);
  expect(result.params).toEqual(null);
});

// test('Query join multiple filter', () => {
//   const result = tasksDb.users
//     .select()
//     .fields({ id: true, email: true })
//     .filter({ id: '1' })
//     .join('id', 'users_tasks', 'user_id')
//     .join('task_id', 'tasks', 'id')
//     .filter({ id: '2' })
//     .all();

//   expect(result.sql).toEqual(
//     'SELECT _0.id AS _0__id, _1.* FROM (SELECT _1.user_id AS _1__user_id, _1.task_id AS _1__task_id, _2.* FROM (SELECT _2.id AS _2__id, _2.email AS _2__email FROM users AS _2 WHERE _2.id == :id) AS _2 LEFT JOIN users_tasks AS _1 ON _2__id == _1__user_id) AS _1 LEFT JOIN tasks AS _0 ON _1__task_id == _0__id WHERE _0.id == :id_1'
//   );
//   expect(result.params).toEqual({ id: '1', id_1: '2' });
// });

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

// describe('Expr', () => {
//   test('Equal', () => {
//     const res = tasksDb.tasks
//       .select()
//       .filter({ id: Expr.equal('1') })
//       .all();
//     expect(res.sql).toEqual('SELECT _0.id AS _0__id FROM tasks AS _0 WHERE _0.id == :id');
//   });

//   test('Different', () => {
//     const res = tasksDb.tasks
//       .select()
//       .filter({ id: Expr.different('1') })
//       .all();
//     expect(res.sql).toEqual('SELECT _0.id AS _0__id FROM tasks AS _0 WHERE _0.id != :id');
//   });
// });
