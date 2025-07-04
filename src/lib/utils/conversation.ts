export interface UserPreferences {
  writing_style?: string;
  tone?: string;
  length_preference?: string;
  formality_level?: string;
  communication_patterns?: string[];
  common_topics?: string[];
}

export interface UserContact {
  name: string;
  email: string;
  role?: string;
  company?: string;
  context?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
}

export const formatUserPreferencesContext = (
  preferences: UserPreferences | null
): string => {
  if (!preferences) return "";

  return `
User Communication Preferences:
- Writing Style: ${preferences.writing_style || "Not specified"}
- Tone: ${preferences.tone || "Not specified"}
- Length Preference: ${preferences.length_preference || "Not specified"}
- Formality Level: ${preferences.formality_level || "Not specified"}
- Communication Patterns: ${
    preferences.communication_patterns?.join(", ") || "None identified"
  }
- Common Topics: ${preferences.common_topics?.join(", ") || "None identified"}`;
};

export const formatContactsContext = (contacts: UserContact[]): string => {
  if (contacts.length === 0) return "";

  return `
Key Contacts (${contacts.length}):
${contacts
  .slice(0, 5)
  .map(
    (contact, index) =>
      `${index + 1}. ${contact.name} (${contact.email})${
        contact.role ? ` - ${contact.role}` : ""
      }${contact.company ? ` at ${contact.company}` : ""}${
        contact.context ? ` - ${contact.context}` : ""
      }`
  )
  .join("\n")}`;
};

export const formatToolsDescription = (tools: MCPTool[]): string => {
  if (tools.length === 0) return "No tools available.";

  return tools
    .map(
      (tool, idx) =>
        `${idx + 1}. ${tool.name}${
          tool.description ? `: ${tool.description}` : ""
        }`
    )
    .join("\n");
};

export const buildEnhancedSystemPrompt = (
  basePrompt: string,
  userFirstName: string,
  preferencesContext: string,
  contactsContext: string,
  toolsDescription: string
): string => {
  return `${basePrompt} 

User's first name: ${userFirstName} 

${preferencesContext}

${contactsContext}

AVAILABLE TOOLS:
${toolsDescription}

TOOL EXECUTION:
You have access to powerful client-side tools that can help users with their requests. When you need to use a tool, call the appropriate client tool function.

Available client tools and when to use them:

📧 EMAIL TOOLS:
- fetch_gmail_emails: Get recent emails from last 7 days
  Use when: "show my emails", "what emails did I get", "recent messages"
- send_email: Send emails via Gmail  
  Use when: "send an email to...", "draft a message", "email John about..."

📅 CALENDAR TOOLS:  
- fetch_calendar_events: Get upcoming calendar events
  Use when: "what's on my calendar", "my meetings today", "schedule this week"
- manage_calendar: Create, update, or delete calendar events
  Use when: "schedule a meeting", "create an event", "cancel my 3pm", "move the meeting"

💬 SLACK TOOLS:
- fetch_slack_messages: Get recent Slack messages  
  Use when: "what's new in Slack", "show Slack updates", "recent team messages"
- send_slack_message: Send messages to Slack channels
  Use when: "send a Slack message", "notify the team", "post to #general"

📄 NOTION TOOLS:
- fetch_notion_pages: Get pages from Notion workspace
  Use when: "show my Notion pages", "what's in my workspace", "find documents"

🔍 SEARCH TOOLS:
- vector_search: Search through emails, documents, and data using AI  
  Use when: "search my emails about X", "find documents about Y", "what did we discuss about Z"
- semantic_search: Search across all connected data sources
  Use when: "search everything about project X", "find all mentions of client Y"

📊 SUMMARY TOOLS:
- get_updates: Get recent summaries and updates
  Use when: "what's new?", "recent updates", "what did I miss", "daily summary"

TOOL USAGE EXAMPLES:
- "Search my emails about the quarterly review" → use vector_search
- "What meetings do I have today?" → use fetch_calendar_events  
- "Send John an email about the project update" → use send_email
- "Schedule a meeting with Sarah tomorrow at 2pm" → use manage_calendar
- "What's new in our team Slack?" → use fetch_slack_messages
- "Find all documents about the product launch" → use semantic_search

Always explain what you're doing when you call a tool, e.g., "Let me search your emails for that information..." or "I'll check your calendar for today's meetings..."

Be proactive in suggesting tools when users ask questions that could benefit from real data.`;
};
