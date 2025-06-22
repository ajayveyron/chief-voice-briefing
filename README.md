# Chief – Your AI Executive Assistant

Chief is a voice-first AI assistant built for busy founders, CXOs, and operators. Whether you're on a commute, having lunch, or in between meetings, Chief gives you quick, actionable insights without needing a screen.

## 🧠 What It Does

Chief connects with your key work tools – Slack, Gmail, and Calendar – and turns scattered updates into a focused voice brief. You can talk to Chief like you would to your Chief of Staff. It listens, understands, summarizes, and suggests – all in natural, human-like speech.

## 🎯 Core Features (v1)

- **Voice-First Interface**: One big button. Tap to talk, and Chief responds naturally.
- **Gmail Integration**: Summarizes unread emails, drafts replies.
- **Slack Integration**: Reads important messages, suggests responses.
- **Calendar Integration**: Summarizes your day, books/reschedules meetings.
- **Context Awareness**: Understand context about user's contacts, projects they are working on, writign style etc


## ⚙️ Tech Stack

- **Frontend**: React
- **Backend**: Supabase (Edge Functions, DB), Node.js
- **LLM Orchestration**: OpenAI + Custom Prompt Engine
- **Speech Layer**: ElevenLabs
- **Auth**: Supabase Auth

## 🧪 Beta Mode

Chief is currently in private beta. Users are onboarded manually and integrations are authenticated via OAuth for Gmail, Slack, and Google Calendar.

## 🗂️ Folder Structure

/src
/components     → UI components
/integrations   → Slack, Gmail, Calendar connectors
/llm            → Prompt generation, response orchestration
/utils          → Helper functions
App.tsx         → Main voice interface logic

## 🧩 Integration Flow (Simplified)

1. **OAuth Auth** → Connect Gmail, Slack, Calendar
2. **Pull Raw Data** → Via Supabase Edge Functions
3. **Summarize + Normalize** → LLMs structure data (emails, messages, events)
4. **Voice Orchestration** → Generates context-specific voice response
5. **Speak** → Streamed audio sent to user

## 📦 Future Plans

- Add support for Notion, Jira, WhatsApp (via A1Base)
- Voice commands to act on messages
- Smart nudges (e.g., "You missed replying to that investor")
- Android version

## 📄 License

MIT

## 🧑‍💻 Author 
Connect with the team at [mychief.app](https://mychief.app)
