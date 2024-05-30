import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const ADMIN = 1 << 3

// Simple test command
const DELETE_STRAY_WEBHOOKS = {
  name: 'clear',
  description: "Sometimes you just got stray webhooks laying around.",
  default_member_permissions: ADMIN
};

// Command with message
const MOVE_THREAD = {
  name: 'Move thread to forum post',
  default_member_permissions: ADMIN,
  type: 3
}

const ALL_COMMANDS = [DELETE_STRAY_WEBHOOKS, MOVE_THREAD];

const appCommands = await InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);

if (appCommands.ok) {
  console.log('Updated commands: ', await appCommands.json());
}
