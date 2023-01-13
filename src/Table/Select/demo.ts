import { Schema } from '../../Schema';
import { ITablesSelect } from './types';

export const tasksSchema = Schema.define({
  tables: {
    tasks: Schema.table({
      id: Schema.column.dt.text().primary(),
      title: Schema.column.dt.text(),
      description: Schema.column.dt.text(),
      completed: Schema.column.dt.boolean(),
    }),
    users: Schema.table({
      id: Schema.column.dt.text().primary(),
      name: Schema.column.dt.text(),
      email: Schema.column.dt.text(),
    }),
    users_tasks: Schema.table({
      user_id: Schema.column.dt.text().primary(),
      task_id: Schema.column.dt.text().primary(),
      token: Schema.column.dt.text(),
    }),
  },
});

const db = {} as ITablesSelect<typeof tasksSchema>;

const tasksWithUserId = db.users_tasks.join('task_id', db.tasks, 'id', (l, tasks) => ({
  userId: l.user_id,
  ...tasks,
}));

const tasksByUser = db.users.select((cols, tools) => ({
  ...cols,
  tasks: tools.joinAll('id', tasksWithUserId, 'userId', ({ userId, ...rest }) => rest),
}));
