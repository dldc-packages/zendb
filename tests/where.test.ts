import { beforeAll, beforeEach, expect, test } from 'vitest';
import { Expr, Random } from '../src/mod';
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

test('Simple filter', () => {
  const query = tasksDb.tasks.query().filterEqual({ id: '1' }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT *
    FROM tasks
    WHERE
      tasks.id == :_id0
  `);
});

test('Filter twice', () => {
  const query = tasksDb.tasks.query().filterEqual({ id: '1' }).filterEqual({ id: '2' }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT *
    FROM tasks
    WHERE
      tasks.id == :_id0 AND tasks.id == :_id2
  `);
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
        'displayName', users.displayName,
        'updatedAt', users.updatedAt
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
      users.email == :_id3
  `);

  expect(query.params).toEqual({ _id3: 'john@example.com' });
});

test('Filter null value', () => {
  const query = tasksDb.users.query().filterEqual({ displayName: null }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT *
    FROM users
    WHERE users.displayName IS NULL
  `);
});

test('Filter multiple values', () => {
  const query = tasksDb.users.query().filterEqual({ displayName: null, email: 'john@example.com' }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT *
    FROM users
    WHERE users.displayName IS NULL AND users.email == :_id0
  `);

  expect(query.params).toEqual({ _id0: 'john@example.com' });
});
