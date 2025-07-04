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

You have access to various tools through MCP servers. When users request actions that can be performed by these tools, you can suggest using them or ask for more specific details to execute the appropriate tool.`;
};
