import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
};

// Command with message
const MESSAGE_COMMAND = {
  name: 'move',
  type: 3
}

const ALL_COMMANDS = [TEST_COMMAND, MESSAGE_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);