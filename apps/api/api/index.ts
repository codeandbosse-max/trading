import { createApp } from '../src/index';

// Vercel entry point: one serverless function handles every route.
// Background workers do not exist here; POST /api/tasks/tick is triggered by a cron.
export default createApp();
