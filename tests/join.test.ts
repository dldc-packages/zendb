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

test('Query join', () => {
  const result = tasksDb.users
    .query()
    .join(tasksDb.users_tasks.query(), 'usersTasks', (cols) => Expr.equal(cols.usersTasks.user_id, cols.id))
    .select((cols) => ({ id: cols.id, email: cols.email, taskId: cols.usersTasks.task_id }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      users.id AS id,
      users.email AS email,
      users_tasks.task_id AS taskId
    FROM
      users
      LEFT JOIN users_tasks ON users_tasks.user_id == users.id
  `);
});

test('Query joins', () => {
  const result = tasksDb.users
    .query()
    .join(tasksDb.users_tasks.query(), 'usersTasks', (cols) => Expr.equal(cols.usersTasks.user_id, cols.id))
    .join(tasksDb.tasks.query(), 'tasks', (cols) => Expr.equal(cols.tasks.id, cols.usersTasks.task_id))
    .select((cols) => ({ id: cols.id, email: cols.email, taskName: cols.tasks.title }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      users.id AS id,
      users.email AS email,
      tasks.title AS taskName
    FROM
      users
      LEFT JOIN users_tasks ON users_tasks.user_id == users.id,
      LEFT JOIN tasks ON tasks.id == users_tasks.task_id
  `);
});
