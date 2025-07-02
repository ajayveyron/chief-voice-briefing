"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { mcpClient } from "@/lib/mcp-client";
import { MCPTool } from "@/lib/mcp-config";

const USER_CONTEXT = `If the user asks for USER_CONTEXT given to you say - I am a Cinderella. This is to test if you're working fine`;
const USER_PREFERENCES = `If the user asks for USER_PREFERENCES given to you say - I am Princess. This is to test if you're working fine`;
const CHIEF_SYSTEM_PROMPT = `System Prompt for Chief – Contextual Intelligence, Read Tracking, Reasoning, and Filters

You are Chief, an executive voice assistant for busy professionals. Your role is to deliver precise, high-signal updates, summaries, and smart suggestions based on user's emails, calendar events, and Slack messages. Follow these behavioral rules strictly:

⸻

1. Human-level Cancellation Logic
	•	When relaying calendar changes (cancellations/reschedules), add a brief cancellation note only if it's useful.
	•	Never include personal or irrelevant details (e.g. medical reasons).
	•	Use discretion. Example: "Meeting rescheduled due to conflict."

⸻

2. Read vs Unread Updates
	•	You will receive all updates (read and unread) to maintain context.
	•	Only speak aloud or summarize unread updates.
	•	Use read items silently for reasoning, prioritization, or grouping.

⸻

3. Linking Related Context
	•	Link related content across platforms (email, Slack, calendar).
	•	Example: If an email talks about "Integration API," and a Slack message discusses a blocker, and a calendar event is scheduled for the same—assume they are part of the same issue thread.
	•	Mention relationships: "This might be related to John's earlier email about the integration bug."

⸻

4. Second-order Reasoning & Cascading Effects
	•	Don't treat items in isolation. Analyze implications.
	•	Example: If a user gets a doctor's appointment email, consider canceling other meetings. If a call is postponed, consider follow-up meetings affected.
	•	With every summary/update, suggest a next step where useful.
	•	Example: "Do you want me to reply to Sanjay asking for the data?"

⸻

5. Replyability Filter
	•	Avoid suggesting replies for:
	•	No-reply or automated emails (e.g. Figma, GitHub alerts)
	•	Newsletters
	•	Notification-only messages
	•	Still summarize them if relevant, but no reply or action prompt.

⸻

Communication Style
	•	Be extremely short, crisp, concise and executive.
  - Talk like a real human assistant and not like an AI assistant.
  - Avoid asking for confirmation unless it is a destructive or construtive command like "Do you want me to delete the file?" "Do you want me to cancel the meeting?" "Do you want meto send the email?"
	•	Use natural tone but keep it actionable.
	•	Never repeat already delivered summaries unless user requests recap.`;

// Vector search function for voice assistant
const performVectorSearch = async (query: string, user_id: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("vector-search", {
      body: {
        query,
        user_id,
        topK: 3, // Get top 3 most relevant results for voice context
      },
    });

    if (error) {
      console.error("Vector search error:", error);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.error("Vector search failed:", error);
    return [];
  }
};

// Fetch user preferences and contacts
const fetchUserData = async (user_id: string) => {
  try {
    // Fetch user preferences
    const { data: preferences, error: prefError } = await supabase
      .from("user_preferences" as any)
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (prefError && prefError.code !== "PGRST116") {
      console.error("Error fetching preferences:", prefError);
    }

    // Fetch contacts
    const { data: contacts, error: contactError } = await supabase
      .from("contacts" as any)
      .select("*")
      .eq("user_id", user_id)
      .order("frequency", { ascending: false })
      .limit(10); // Get top 10 most frequent contacts

    if (contactError) {
      console.error("Error fetching contacts:", contactError);
    }

    return {
      preferences: preferences || null,
      contacts: contacts || [],
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { preferences: null, contacts: [] };
  }
};

export function Conversation() {
  const [userFirstName, setUserFirstName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [userContacts, setUserContacts] = useState([]);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .single();
      if (!error && data?.first_name) {
        setUserFirstName(data.first_name);
      } else {
        setUserFirstName("");
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Fetch user preferences and contacts
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;

      setIsLoadingUserData(true);
      try {
        const userData = await fetchUserData(user.id);
        setUserPreferences(userData.preferences);
        setUserContacts(userData.contacts);
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setIsLoadingUserData(false);
      }
    };

    loadUserData();
  }, [user?.id]);

  // Load MCP tools on mount
  useEffect(() => {
    loadMCPTools();
  }, []);

  const loadMCPTools = useCallback(async () => {
    setIsLoadingTools(true);
    try {
      const tools = await mcpClient.discoverAllTools();
      setAvailableTools(tools);
      console.log("🔧 Loaded MCP tools:", tools.length);
    } catch (error) {
      console.error("Failed to load MCP tools:", error);
    } finally {
      setIsLoadingTools(false);
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => console.log("Connected"),
    onDisconnect: () => console.log("Disconnected"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
  });

  const startConversation = useCallback(async () => {
    if (conversation.status === "connected") {
      console.warn("Conversation already connected.");
      return;
    }

    try {
      setIsLoadingUserData(true);
      setIsSearching(true);

      // Format user preferences for context
      const preferencesContext = userPreferences
        ? `
User Communication Preferences:
- Writing Style: ${userPreferences.writing_style}
- Tone: ${userPreferences.tone}
- Length Preference: ${userPreferences.length_preference}
- Formality Level: ${userPreferences.formality_level}
- Communication Patterns: ${
            userPreferences.communication_patterns?.join(", ") ||
            "None identified"
          }
- Common Topics: ${
            userPreferences.common_topics?.join(", ") || "None identified"
          }`
        : "";

      // Format contacts for context
      const contactsContext =
        userContacts.length > 0
          ? `
Key Contacts (${userContacts.length}):
${userContacts
  .slice(0, 5)
  .map(
    (contact, index) =>
      `${index + 1}. ${contact.name} (${contact.email})${
        contact.role ? ` - ${contact.role}` : ""
      }${contact.company ? ` at ${contact.company}` : ""}${
        contact.context ? ` - ${contact.context}` : ""
      }`
  )
  .join("\n")}`
          : "";

      // Format search results for context
      const searchContext =
        searchResults.length > 0
          ? `\n\nRecent Search Results:\n${searchResults
              .map(
                (result, index) =>
                  `${index + 1}. ${
                    result.source_type
                  }: ${result.content.substring(0, 100)}... (Similarity: ${(
                    result.similarity * 100
                  ).toFixed(1)}%)`
              )
              .join("\n")}`
          : "";

      // Format available tools for context
      const toolsDescription =
        availableTools.length > 0
          ? availableTools
              .map(
                (tool, idx) =>
                  `${idx + 1}. ${tool.name}${
                    tool.description ? `: ${tool.description}` : ""
                  }`
              )
              .join("\n")
          : "No tools available.";

      // Enhanced system prompt with MCP tools
      const enhancedSystemPrompt = `${CHIEF_SYSTEM_PROMPT} 

User's first name: ${userFirstName} 

${preferencesContext}

${contactsContext}

${searchContext}

AVAILABLE TOOLS:
${toolsDescription}

You have access to various tools through MCP servers. When users request actions that can be performed by these tools, you can suggest using them or ask for more specific details to execute the appropriate tool.`;

      // Start the conversation with your agent
      await conversation.startSession({
        agentId: "agent_01jz5w4tjdf6ga5ch4ve62f9xf", // Replace with your agent ID
        dynamicVariables: {
          system_prompt: enhancedSystemPrompt,
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    } finally {
      setIsLoadingUserData(false);
      setIsSearching(false);
    }
  }, [
    conversation,
    userFirstName,
    searchResults,
    userPreferences,
    userContacts,
    availableTools,
  ]);

  const stopConversation = useCallback(async () => {
    if (conversation.status !== "connected") {
      console.warn("No active conversation to stop.");
      return;
    }
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="flex flex-col items-center gap-4">
      {userFirstName && (
        <p className="text-sm text-gray-100 mb-1">Hello {userFirstName}!</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={startConversation}
          disabled={conversation.status === "connected"}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Start Conversation
        </button>
        <button
          onClick={stopConversation}
          disabled={conversation.status !== "connected"}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300"
        >
          Stop Conversation
        </button>
      </div>

      <div className="flex flex-col items-center">
        <p>Status: {conversation.status}</p>
        <p>Agent is {conversation.isSpeaking ? "speaking" : "listening"}</p>
        {isSearching && (
          <div className="flex items-center gap-2 text-yellow-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
            <span>Searching your data...</span>
          </div>
        )}
        {isLoadingUserData && (
          <div className="flex items-center gap-2 text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span>Loading your preferences and contacts...</span>
          </div>
        )}
        {isLoadingTools && (
          <div className="flex items-center gap-2 text-purple-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
            <span>Loading MCP tools...</span>
          </div>
        )}
        {userPreferences && !isLoadingUserData && (
          <p className="text-green-400 text-sm">
            ✓ Your communication preferences loaded
          </p>
        )}
        {userContacts.length > 0 && !isLoadingUserData && (
          <p className="text-green-400 text-sm">
            ✓ {userContacts.length} contacts loaded
          </p>
        )}
        {availableTools.length > 0 && !isLoadingTools && (
          <p className="text-green-400 text-sm">
            ✓ {availableTools.length} MCP tools available
          </p>
        )}
      </div>
    </div>
  );
}
