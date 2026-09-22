export const QUEUES = {
  training: 'training',
  misImport: 'mis-import',
  notifications: 'notifications',
  files: 'files',
  payouts: 'payouts',
  maintenance: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
