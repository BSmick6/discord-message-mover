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
let thread_id;

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, data, guild_id } = req.body;

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

    // clear stray webhooks
    if (name === 'clear') {
      const webhooks = await (await DiscordRequest(`guilds/${guild_id}/webhooks`, {})).json()
      console.log('hooks', webhooks);
      await Promise.all(webhooks.map(async (webhook) => {
        await DiscordRequest(`webhooks/${webhook.id}`, {
          method: 'DELETE'
        })
      }))
      res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'cleared the hooks',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      })
    }

    // message command for migrate a thread to a forum post
    if (name === 'Move thread to forum post') {
      // get data
      const { target_id } = data
      thread_id = data.resolved.messages[target_id]?.thread.id

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
    const forum_post_id = data.values[0]
    const { name: post_name, parent_id: forum_id } = data.resolved.channels[forum_post_id]

    // create new message
    try {
      let webhookResponse = await DiscordRequest(`channels/${forum_id}/webhooks`, {
        method: 'POST',
        body: {
          name: 'mover'
        }
      })
      let webhook
      if (webhookResponse.ok) {
        webhook = await webhookResponse.json()
      }
      if (thread_id) {
        function moveMessage(messageToSend) {
          return DiscordRequest(`webhooks/${webhook.id}/${webhook.token}?thread_id=${forum_post_id}`, {
            method: 'POST',
            body: {
              content: messageToSend.content,
              username: messageToSend.author.global_name,
              avatar_url: `https://cdn.discordapp.com/avatars/${messageToSend.author.id}/${messageToSend.author.avatar}`,
              flags: 1 << 12
            }
          }).then(() => new Promise(resolve => setTimeout(resolve, 400)))
        }

        const messages = (await (await DiscordRequest(`channels/${thread_id}/messages?limit=100`, {})).json()).reverse()
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
      }
    } catch (error) {
      console.error(error);
    }

    // return success or something
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'you selected ' + post_name,
        flags: InteractionResponseFlags.EPHEMERAL,
      }
    })
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
