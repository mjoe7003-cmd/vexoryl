import { notifyCreator } from '../src/services/notificationService.js';

const COUNT = Math.max(1, Number(process.env.NOTIFICATION_COUNT || 100));
const creatorId = process.env.CREATOR_ID || 'notification-stress-creator';
const types = ['gift', 'milestone', 'director', 'policy'];
const events = Array.from({ length: COUNT }, (_, index) => ({
  type: types[index % types.length],
  title: `Stress notification ${index + 1}`,
  sequence: index + 1,
  createdAt: new Date().toISOString(),
}));
const results = await Promise.allSettled(events.map((event) => notifyCreator(creatorId, event)));
const failed = results.filter((result) => result.status === 'rejected');
const delivered = results.filter((result) => result.status === 'fulfilled').length;
const passed = failed.length === 0 && delivered === COUNT;
console.log(JSON.stringify({ requested: COUNT, delivered, dropped: failed.length, passed }, null, 2));
if (!passed) process.exitCode = 1;
