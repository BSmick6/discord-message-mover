import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, DiscordRequest } from './utils.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for message component work
let message, thread;

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      const guild_id = '1244785690747605062'
      const webhooks = await (await DiscordRequest(`guilds/${guild_id}/webhooks`, {})).json()
      console.log('webhooks', webhooks)

      await Promise.all(webhooks.map(async (webhook) => {
        await DiscordRequest(`webhooks/${webhook.id}`, {
          method: 'DELETE'
        })
      }))
      res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'deleted all hooks',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      })
    }

    // "move" message command
    if (name === 'move') {
      // get data
      const { messages } = data.resolved
      const message_id = Object.keys(messages)[0]
      message = messages[message_id]

      // save thread for later
      if (message.thread) {
        thread = message.thread
      }

      // send message component
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'we in the msg command',
          flags: InteractionResponseFlags.EPHEMERAL,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.CHANNEL_SELECT,
                  custom_id: 'channel_select'
                }
              ]
            }
          ]
        }
      })
    }
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const { channels } = data.resolved
    const channel_id = Object.keys(channels)[0]
    const channel = channels[channel_id]

    // create new message
    try {
      let webhookResponse = await DiscordRequest(`channels/${channel.parent_id || channel_id}/webhooks`, {
        method: 'POST',
        body: {
          name: 'mover'
        }
      })
      let webhook
      if (webhookResponse.ok) {
        webhook = await webhookResponse.json()
      }
      if (thread) {
        function moveMessage(messageToSend) {
          return DiscordRequest(`webhooks/${webhook.id}/${webhook.token}?thread_id=${channel_id}`, {
            method: 'POST',
            body: {
              content: messageToSend.content,
              username: messageToSend.author.global_name,
              avatar_url: `https://cdn.discordapp.com/avatars/${messageToSend.author.id}/${messageToSend.author.avatar}`,
              flags: 1 << 12
            }
          }).then(() => new Promise(resolve => setTimeout(resolve, 400)))
        }

        const messages = (await (await DiscordRequest(`channels/${thread.id}/messages?limit=100`, {})).json()).reverse()
        console.log('msg count', messages.length);
        let result = messages.reduce((accumulatorPromise, currentMsg) => {
          return accumulatorPromise.then(() => {
            if (currentMsg.content) {
              return moveMessage(currentMsg);
            } else {
              return
            }
          });
        }, Promise.resolve());

        result.then(() => {
          console.log("All Promises Resolved !!✨")
          DiscordRequest(`webhooks/${webhook.id}`, {
            method: 'DELETE'
          })
        });
      } else {
        await DiscordRequest(`webhooks/${webhook.id}/${webhook.token}`, {
          method: 'POST',
          body: {
            content: message.content,
            username: message.author.global_name,
            avatar_url: `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}`,
            flags: 1 << 12
          }
        })
        await DiscordRequest(`webhooks/${webhook.id}`, {
          method: 'DELETE'
        })
      }
    } catch (error) {
      console.error(error);
    }

    // return success or something
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'you selected ' + channels[channel_id].name,
        flags: InteractionResponseFlags.EPHEMERAL,
      }
    })
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
