import { Database, Query } from '../src/mod';
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
  const query = tasksDatabase.tables.users.query().select({ id: true, email: true });
  const result = Query.resolve(query);
  expect(result.query).toEqual('SELECT _0.id AS _0__id, _0.email AS _0__email FROM users AS _0');
  expect(result.params).toEqual(null);
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
