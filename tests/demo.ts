import { ColumnDef, Database, Expr } from '../src/mod';

const db = Database({
  tasks: {
    id: ColumnDef.dt.text().primary(),
    title: ColumnDef.dt.text(),
    description: ColumnDef.dt.text(),
    completed: ColumnDef.dt.boolean(),
  },
  users: {
    id: ColumnDef.dt.text().primary(),
    name: ColumnDef.dt.text(),
    email: ColumnDef.dt.text(),
  },
  users_tasks: {
    user_id: ColumnDef.dt.text().primary(),
    task_id: ColumnDef.dt.text().primary(),
    token: ColumnDef.dt.text(),
  },
});

const tasksWithUserId = db.users_tasks
  .query()
  .join(db.tasks.query(), 'tasks', (c) => Expr.equal(c.tasks.id, c.task_id))
  .select((c) => ({ userId: c.user_id, ...c.tasks }));

console.log(tasksWithUserId);

// const tasksByUser = db.users.query().select((users) => ({
//   ...users,
//   tasks: Populate.all(users.id, tasksWithUserId, 'userId', (c) => Expr.ScalarFunctions.json_object(c)),
// }));

// console.log(tasksByUser);

// const tasksByUser2 = db.users.query().join(
//   db.users_tasks
//     .query()
//     .join(
//       db.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, tasks) => ({
//         userId: l.user_id,
//         tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(tasks)),
//       })
//     )
//     .groupBy((cols) => [cols.userId]),
//   (l, r) => Expr.equal(l.id, r.userId),
//   (l, r) => ({
//     ...l,
//     tasks: r.tasks,
//   })
// );

// const res: Array<(typeof tasksByUser2)[TYPES]> = {} as any;

// console.log(res);

// res.forEach((item) => {
//   item.tasks.forEach((task) => {
//     console.log(task.completed);
//   });
// });
