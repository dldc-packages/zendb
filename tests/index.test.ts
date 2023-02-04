import { Expr, Random } from '../src/mod';
import { allDatatypesDb } from './utils/allDatatypesDb';
import { tasksDb } from './utils/tasksDb';

let nextRandomId = 0;

beforeAll(() => {
  // disable random suffix for testing
  Random.setCreateId(() => `test_${nextRandomId++}`);
});

beforeEach(() => {
  nextRandomId = 0;
});

test('Insert', () => {
  const result = tasksDb.users.insert({ id: '1', name: 'John Doe', email: 'john@exemple.com' });
  expect(result).toMatchObject({
    kind: 'Insert',
    params: ['1', 'John Doe', 'john@exemple.com'],
    sql: 'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
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
    params: { delete_id_test_0: '1' },
    sql: 'DELETE FROM users WHERE users.id == :delete_id_test_0',
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
    params: { name_test_0: 'Paul' },
    sql: "UPDATE users SET name = :name_test_0 WHERE users.id == '1234'",
  });
});

test('Update with external', () => {
  const result = tasksDb.users.update({ name: 'Paul' }, { where: (cols) => Expr.equal(cols.id, Expr.external('1234', 'filter_id')) });
  expect(result).toMatchObject({
    kind: 'Update',
    params: { filter_id_test_0: '1234', name_test_1: 'Paul' },
    sql: 'UPDATE users SET name = :name_test_1 WHERE users.id == :filter_id_test_0',
  });
});

test('Update One', () => {
  const result = tasksDb.users.updateOne({ name: 'Paul' }, (cols) => Expr.equal(cols.id, Expr.literal('1234')));
  expect(result).toMatchObject({
    kind: 'Update',
    params: { name_test_0: 'Paul' },
    sql: "UPDATE users SET name = :name_test_0 WHERE users.id == '1234' LIMIT 1",
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
    .select((cols) => ({ idEmail: Expr.concatenate(cols.id, cols.email), ...cols }))
    .all();
  expect(result.sql).toEqual(
    `WITH cte_test_1 AS (SELECT users.id AS id, users.email AS email FROM users) SELECT cte_test_1.id || cte_test_1.email AS idEmail, cte_test_1.id AS id, cte_test_1.email AS email FROM cte_test_1`
  );
  expect(result.params).toEqual(null);
});

// test('Query join', () => {
//   const result = tasksDb.users.query()
//     .select(({ id, email }) => ({ id, email }))
//     .filter(c => Expr.equal(c.id, Expr.literal('1')))
//     .join(tasksDb.users_tasks.query(), (c, t) => Expr.equal(c.id, t.user_id), '')
//     .join('id', 'users_tasks', 'user_id')
//     .join('task_id', 'tasks', 'id')
//     .all();
//   expect(result.sql).toEqual(
//     'SELECT _0.id AS _0__id, _1.* FROM (SELECT _1.user_id AS _1__user_id, _1.task_id AS _1__task_id, _2.* FROM (SELECT _2.id AS _2__id, _2.email AS _2__email FROM users AS _2 WHERE _2.id == :id) AS _2 LEFT JOIN users_tasks AS _1 ON _2__id == _1__user_id) AS _1 LEFT JOIN tasks AS _0 ON _1__task_id == _0__id'
//   );
//   expect(result.params).toEqual({ id: '1' });
// });

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
    sql: 'INSERT INTO datatype (id, text, integer, boolean, date, json, number) VALUES (?, ?, ?, ?, ?, ?, ?)',
    params: ['1', 'test', 42, 1, 1663075512250, '{"foo":"bar","baz":true}', 3.14],
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
