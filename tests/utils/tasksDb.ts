import { ColumnDef, Database } from '../../src/mod';

export const tasksDb = Database({
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
    displayName: ColumnDef.dt.text().nullable(),
  },
  users_tasks: {
    user_id: ColumnDef.dt.text().primary(),
    task_id: ColumnDef.dt.text().primary(),
  },
});
