import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';

export function VerifyDiscordRequest(clientKey) {
  return function (req, res, buf, encoding) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/BSmick6/discord-message-mover, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function GetMessagesFromThread(thread) {
  let messages = []
  let lastMsgID = null;
  do {
    const before = lastMsgID ? `&before=${lastMsgID}` : '';
    const getMsgsResp = await DiscordRequest(`channels/${thread.id}/messages?limit=100${before}`, {})
    messages = messages.concat(await getMsgsResp.json())
    lastMsgID = messages.at(-1).id
  } while (messages.length < thread.message_count)
  return messages.reverse()
}

export function CreateFirstPostMessage(message) {
  const dateTime = new Date(message.timestamp)
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  })
  return `${message.content}
👤 original author: <@${message.author.id}>
🕒 originally posted on ${dateFormat.format(dateTime)} at ${timeFormat.format(dateTime)}`
}

export async function CreateWebhook(channel_id, name) {
  const response = await DiscordRequest(`channels/${channel_id}/webhooks`, {
    method: 'POST',
    body: { name }
  })
  return response.json()
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    return await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
