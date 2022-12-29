import { Database, Expr } from '../src/mod';
import { allDatatypesSchema } from './utils/allDatatypesSchema';
import { tasksSchema } from './utils/tasksSchema';

const tasksDatabase = Database.create(tasksSchema);

test('Insert', () => {
  const result = tasksDatabase.tables.users.insert({ id: '1', name: 'John Doe', email: 'john@exemple.com' });
  expect(result).toEqual({
    query: 'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
    params: ['1', 'John Doe', 'john@exemple.com'],
    inserted: { email: 'john@exemple.com', id: '1', name: 'John Doe' },
  });
});

test('Delete', () => {
  const result = tasksDatabase.tables.users.delete({ id: '1' });
  expect(result).toEqual({
    query: 'DELETE FROM users WHERE users.id == :id',
    params: { id: '1' },
  });
});

test('Delete One', () => {
  const result = tasksDatabase.tables.users.deleteOne({ id: '1' });
  expect(result).toEqual({
    query: 'DELETE FROM users WHERE users.id == :id LIMIT 1',
    params: { id: '1' },
  });
});

test('Update', () => {
  const result = tasksDatabase.tables.users.update({ name: 'Paul' }, { where: { id: '1234' } });
  expect(result).toEqual({
    query: 'UPDATE users SET name = :name WHERE users.id == :id',
    params: { id: '1234', name: 'Paul' },
  });
});

test('Update One', () => {
  const result = tasksDatabase.tables.users.updateOne({ name: 'Paul' }, { id: '1234' });
  expect(result).toEqual({
    query: 'UPDATE users SET name = :name WHERE users.id == :id LIMIT 1',
    params: { id: '1234', name: 'Paul' },
  });
});

test('Query', () => {
  const result = tasksDatabase.tables.users.query().select({ id: true, email: true }).resolve();
  expect(result.query).toEqual('SELECT _0.id AS _0__id, _0.email AS _0__email FROM users AS _0');
  expect(result.params).toEqual(null);
});

test('Query join', () => {
  const result = tasksDatabase.tables.users
    .query()
    .select({ id: true, email: true })
    .filter({ id: '1' })
    .join('id', 'users_tasks', 'user_id')
    .join('task_id', 'tasks', 'id')
    .resolve();
  expect(result.query).toEqual(
    'SELECT _0.id AS _0__id, _1.* FROM (SELECT _1.user_id AS _1__user_id, _1.task_id AS _1__task_id, _2.* FROM (SELECT _2.id AS _2__id, _2.email AS _2__email FROM users AS _2 WHERE _2.id == :id) AS _2 LEFT JOIN users_tasks AS _1 ON _2__id == _1__user_id) AS _1 LEFT JOIN tasks AS _0 ON _1__task_id == _0__id'
  );
  expect(result.params).toEqual({ id: '1' });
});

test('Query join multiple filter', () => {
  const result = tasksDatabase.tables.users
    .query()
    .select({ id: true, email: true })
    .filter({ id: '1' })
    .join('id', 'users_tasks', 'user_id')
    .join('task_id', 'tasks', 'id')
    .filter({ id: '2' })
    .resolve();

  expect(result.query).toEqual(
    'SELECT _0.id AS _0__id, _1.* FROM (SELECT _1.user_id AS _1__user_id, _1.task_id AS _1__task_id, _2.* FROM (SELECT _2.id AS _2__id, _2.email AS _2__email FROM users AS _2 WHERE _2.id == :id) AS _2 LEFT JOIN users_tasks AS _1 ON _2__id == _1__user_id) AS _1 LEFT JOIN tasks AS _0 ON _1__task_id == _0__id WHERE _0.id == :id_1'
  );
  expect(result.params).toEqual({ id: '1', id_1: '2' });
});

test('read and write datatypes', () => {
  const db = Database.create(allDatatypesSchema);

  const result = db.tables.datatype.insert({
    id: '1',
    text: 'test',
    boolean: true,
    date: new Date(2022, 8, 13, 15, 25, 12, 250),
    integer: 42,
    number: 3.14,
    json: { foo: 'bar', baz: true },
  });
  expect(result).toEqual({
    inserted: {
      boolean: true,
      date: new Date('2022-09-13T13:25:12.250Z'),
      id: '1',
      integer: 42,
      json: { baz: true, foo: 'bar' },
      number: 3.14,
      text: 'test',
    },
    params: ['1', 'test', 42, 1, 1663075512250, '{"foo":"bar","baz":true}', 3.14],
    query: 'INSERT INTO datatype (id, text, integer, boolean, date, json, number) VALUES (?, ?, ?, ?, ?, ?, ?)',
  });
});

describe('Expr', () => {
  test('Equal', () => {
    const res = tasksDatabase.tables.tasks
      .query()
      .filter({ id: Expr.equal('1') })
      .resolve();
    expect(res.query).toEqual('SELECT _0.id AS _0__id FROM tasks AS _0 WHERE _0.id == :id');
  });

  test('Different', () => {
    const res = tasksDatabase.tables.tasks
      .query()
      .filter({ id: Expr.different('1') })
      .resolve();
    expect(res.query).toEqual('SELECT _0.id AS _0__id FROM tasks AS _0 WHERE _0.id != :id');
  });
});
