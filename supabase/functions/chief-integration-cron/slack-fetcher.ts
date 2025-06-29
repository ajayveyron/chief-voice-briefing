
import { UserIntegration, SlackMessage } from './types.ts';

export async function fetchSlackData(integration: UserIntegration, validToken: string): Promise<SlackMessage[]> {
  try {
    const messagesResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=false&limit=20', {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error(`Slack API error: ${messagesResponse.status}`);
    }

    const channelsData = await messagesResponse.json();
    if (!channelsData.ok) {
      throw new Error(`Slack API error: ${channelsData.error}`);
    }

    const messages: SlackMessage[] = [];
    const channels = channelsData.channels || [];

    for (const channel of channels.slice(0, 5)) {
      if (channel.is_member) {
        try {
          const historyResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=10`, {
            headers: {
              'Authorization': `Bearer ${validToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            if (historyData.ok && historyData.messages) {
              for (const message of historyData.messages) {
                if (message.text && !message.bot_id) {
                  messages.push({
                    id: message.ts,
                    text: message.text,
                    user: message.user || 'Unknown',
                    channel: `#${channel.name}`,
                    timestamp: new Date(parseFloat(message.ts) * 1000).toISOString()
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching messages from channel ${channel.name}:`, error);
        }
      }
    }

    return messages;
  } catch (error) {
    console.error(`Error fetching Slack data:`, error);
    return [];
  }
}
