import { beforeAll, beforeEach, expect, test } from 'vitest';
import { Database, Expr, Random } from '../src/mod';
import { TestDatabase } from './utils/TestDatabase';
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

const db = TestDatabase.create();

test('create database', () => {
  const res = db.execMany(Database.schema(tasksDb));
  expect(res).toEqual([null, null, null]);
  const tables = db.exec(Database.tables());
  expect(tables).toEqual(['tasks', 'users', 'users_tasks']);
});

test('insert tasks', () => {
  const res = db.exec(tasksDb.tasks.insert({ id: '1', title: 'Task 1', completed: false, description: 'First task' }));
  expect(res).toEqual({ id: '1', title: 'Task 1', completed: false, description: 'First task' });
});

test('find tasks', () => {
  const res = db.exec(
    tasksDb.tasks
      .query()
      .select(({ id, title }) => ({ id, title }))
      .all(),
  );
  expect(res).toEqual([{ id: '1', title: 'Task 1' }]);
});

test('create user', () => {
  const res = db.exec(tasksDb.users.insert({ id: '1', name: 'John', email: 'john@example.com', displayName: null }));
  expect(res).toEqual({ id: '1', name: 'John', email: 'john@example.com', displayName: null });
});

test('link task and user', () => {
  const res = db.exec(tasksDb.users_tasks.insert({ user_id: '1', task_id: '1' }));
  expect(res).toEqual({ user_id: '1', task_id: '1' });
});

test('Query tasks as object', () => {
  const res = db.exec(
    tasksDb.tasks
      .query()
      .select((c) => ({
        id: c.id,
        data: Expr.jsonObj(c),
      }))
      .all(),
  );
  res.forEach((r) => {
    expect(typeof r.data.completed).toBe('boolean');
  });
  expect(res).toEqual([{ data: { completed: false, description: 'First task', id: '1', title: 'Task 1' }, id: '1' }]);
});

test('Query users as object', () => {
  const res = db.exec(
    tasksDb.users
      .query()
      .select((c) => ({
        id: c.id,
        data: Expr.jsonObj(c),
      }))
      .all(),
  );
  expect(res).toEqual([{ data: { displayName: null, email: 'john@example.com', id: '1', name: 'John' }, id: '1' }]);
});

test('Concatenate nullable should return nullable', () => {
  const res = db.exec(
    tasksDb.users
      .query()
      .select((c) => ({
        id: c.id,
        name: Expr.concatenate(c.name, c.displayName),
      }))
      .first(),
  );
  expect(res).toEqual({ id: '1', name: null });
});

test('Find user by email', () => {
  const res = db.exec(
    tasksDb.users
      .query()
      .where((c) => Expr.equal(c.email, Expr.external('john@example.com')))
      .first(),
  );

  expect(res).toEqual({ id: '1', displayName: null, name: 'John', email: 'john@example.com' });
});

test('Find user by email using compare', () => {
  const res = db.exec(
    tasksDb.users
      .query()
      .where((c) => Expr.compare(c.email, '=', 'john@example.com'))
      .first(),
  );

  expect(res).toEqual({ id: '1', displayName: null, name: 'John', email: 'john@example.com' });
});

test('Find user by email using filterEqual', () => {
  const res = db.exec(tasksDb.users.query().filterEqual({ email: 'john@example.com' }).first());
  expect(res).toEqual({ id: '1', displayName: null, name: 'John', email: 'john@example.com' });
});

test('Find tasks with user', () => {
  const tasksWithUser = tasksDb.users_tasks
    .query()
    .leftJoin(tasksDb.tasks.query(), 'task', (cols) => Expr.equal(cols.task_id, cols.task.id))
    .leftJoin(tasksDb.users.query(), 'user', (cols) => Expr.equal(cols.user_id, cols.user.id))
    .select((cols) => ({
      user: Expr.jsonObj(cols.user),
      task: Expr.jsonObj(cols.task),
    }));

  const res = db.exec(tasksWithUser.all());
  expect(res).toEqual([
    {
      task: { completed: false, description: 'First task', id: '1', title: 'Task 1' },
      user: { displayName: null, email: 'john@example.com', id: '1', name: 'John' },
    },
  ]);
});

test('Find task by user email', () => {
  const tasksWithUser = tasksDb.users_tasks
    .query()
    .leftJoin(tasksDb.tasks.query(), 'task', (cols) => Expr.equal(cols.task_id, cols.task.id))
    .leftJoin(tasksDb.users.query(), 'user', (cols) => Expr.equal(cols.user_id, cols.user.id))
    .select((cols) => ({
      user: Expr.jsonObj(cols.user),
      task: Expr.jsonObj(cols.task),
    }));

  const query = tasksWithUser.filterEqual({ 'user.email': 'john@example.com' }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT
      json_object(
        'id', users.id,
        'name', users.name,
        'email', users.email,
        'displayName', users.displayName
      ) AS user,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS task
    FROM
      users_tasks
      LEFT JOIN tasks ON users_tasks.task_id == tasks.id
      LEFT JOIN users ON users_tasks.user_id == users.id
    WHERE
      users.email == :_id6
  `);

  const res = db.exec(query);
  expect(res).toEqual({
    task: { completed: false, description: 'First task', id: '1', title: 'Task 1' },
    user: { displayName: null, email: 'john@example.com', id: '1', name: 'John' },
  });
});

// test('tasks grouped by userId', () => {
//   const op = tasksDb.users_tasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     )
//     .all();

//   const res = db.exec(op);

//   expect(res).toEqual([{ user_id: '1', tasks: [{ completed: false, description: 'First task', id: '1', title: 'Task 1' }] }]);
// });

// test('find tasks for user email', () => {
//   const tasksByUserId = tasksDb.users_tasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     );

//   const op = tasksDb.users
//     .query()
//     .where((c) => Expr.equal(c.email, Expr.literal('john@example.com')))
//     .join(
//       tasksByUserId,
//       (l, r) => Expr.equal(l.id, r.user_id),
//       (l, r) => ({ id: l.id, name: l.name, tasks: r.tasks })
//     )
//     .all();

//   const res = db.exec(op);
//   expect(res).toEqual([{ id: '1', name: 'John', tasks: [{ completed: false, description: 'First task', id: '1', title: 'Task 1' }] }]);
// });
