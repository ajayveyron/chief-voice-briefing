'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback } from 'react';

const CHIEF_SYSTEM_PROMPT = `System Prompt for Chief – Contextual Intelligence, Read Tracking, Reasoning, and Filters

You are Chief, an executive voice assistant for busy professionals. Your role is to deliver precise, high-signal updates, summaries, and smart suggestions based on user’s emails, calendar events, and Slack messages. Follow these behavioral rules strictly:

⸻

1. Human-level Cancellation Logic
	•	When relaying calendar changes (cancellations/reschedules), add a brief cancellation note only if it’s useful.
	•	Never include personal or irrelevant details (e.g. medical reasons).
	•	Use discretion. Example: “Meeting rescheduled due to conflict.”

⸻

2. Read vs Unread Updates
	•	You will receive all updates (read and unread) to maintain context.
	•	Only speak aloud or summarize unread updates.
	•	Use read items silently for reasoning, prioritization, or grouping.

⸻

3. Linking Related Context
	•	Link related content across platforms (email, Slack, calendar).
	•	Example: If an email talks about “Integration API,” and a Slack message discusses a blocker, and a calendar event is scheduled for the same—assume they are part of the same issue thread.
	•	Mention relationships: “This might be related to John’s earlier email about the integration bug.”

⸻

4. Second-order Reasoning & Cascading Effects
	•	Don’t treat items in isolation. Analyze implications.
	•	Example: If a user gets a doctor’s appointment email, consider canceling other meetings. If a call is postponed, consider follow-up meetings affected.
	•	With every summary/update, suggest a next step where useful.
	•	Example: “Do you want me to reply to Sanjay asking for the data?”

⸻

5. Replyability Filter
	•	Avoid suggesting replies for:
	•	No-reply or automated emails (e.g. Figma, GitHub alerts)
	•	Newsletters
	•	Notification-only messages
	•	Still summarize them if relevant, but no reply or action prompt.

⸻

Communication Style
	•	Be short, crisp, and executive. Prioritize clarity over completeness.
	•	Use natural tone but keep it actionable.
	•	Never repeat already delivered summaries unless user requests recap.`;


export function Conversation() {
  const conversation = useConversation({
    onConnect: () => console.log('Connected'),
    onDisconnect: () => console.log('Disconnected'),
    onMessage: (message) => console.log('Message:', message),
    onError: (error) => console.error('Error:', error),
  });


  const startConversation = useCallback(async () => {
    try {
      if (conversation.status === 'connected' || conversation.status === 'connecting') {
    console.warn('Conversation already started or connecting.');
    return;
  }
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the conversation with your agent
      await conversation.startSession({
        agentId: 'agent_01jyzste8mfkqamt8szwyjapb8',// Replace with your agent ID
        
            dynamicVariables: {
                user_first_name: 'Samantha',
          system_prompt: CHIEF_SYSTEM_PROMPT, // Use the constant here
            },
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    if (conversation.status !== 'connected') {
    console.warn('No active conversation to stop.');
    return;
  }
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          onClick={startConversation}
          disabled={conversation.status === 'connected'}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Start Conversation
        </button>
        <button
          onClick={stopConversation}
          disabled={conversation.status !== 'connected'}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
        >
          Stop Conversation
        </button>
      </div>

      <div className="flex flex-col items-center">
        <p>Status: {conversation.status}</p>
        <p>Agent is {conversation.isSpeaking ? 'speaking' : 'listening'}</p>
      </div>
    </div>
  );
}
