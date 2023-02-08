import { Database } from '../src/mod';
import { tasksDb } from './utils/tasksDb';
import { TestDatabase } from './utils/TestDatabase';

const db = TestDatabase.create();

test('create database', () => {
  const res = db.execMany(Database.createTables(tasksDb));
  expect(res).toEqual([null, null, null]);
  const tables = db.exec(Database.listTables());
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
      .select((c) => ({ id: c.id, title: c.title }))
      .all()
  );
  expect(res).toEqual([{ id: '1', title: 'Task 1' }]);
});

test('create user', () => {
  const res = db.exec(tasksDb.users.insert({ id: '1', name: 'John', email: 'john@example.com' }));
  expect(res).toEqual({ id: '1', name: 'John', email: 'john@example.com' });
});

test('link task and user', () => {
  const res = db.exec(tasksDb.users_tasks.insert({ user_id: '1', task_id: '1' }));
  expect(res).toEqual({ user_id: '1', task_id: '1' });
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
