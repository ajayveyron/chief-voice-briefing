import { useState, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { mcpClient } from "@/lib/mcp-client";
import { MCPTool } from "@/lib/mcp-config";
import { CHIEF_SYSTEM_PROMPT, ELEVENLABS_AGENT_ID } from "@/lib/constants";
import {
  formatUserPreferencesContext,
  formatContactsContext,
  formatToolsDescription,
  buildEnhancedSystemPrompt,
} from "@/lib/utils/conversation";

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

export interface UseChiefConversationReturn {
  conversation: ReturnType<typeof useConversation>;
  userFirstName: string;
  userPreferences: any;
  userContacts: any[];
  availableTools: MCPTool[];
  isLoadingUserData: boolean;
  isLoadingTools: boolean;
  startConversation: () => Promise<void>;
  stopConversation: () => Promise<void>;
  isReady: boolean;
}

export const useChiefConversation = (): UseChiefConversationReturn => {
  const { user } = useAuth();
  const [userFirstName, setUserFirstName] = useState("");
  const [userPreferences, setUserPreferences] = useState(null);
  const [userContacts, setUserContacts] = useState([]);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  const conversation = useConversation({
    onConnect: () => console.log("Connected to ElevenLabs"),
    onDisconnect: () => console.log("Disconnected from ElevenLabs"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
  });

  // Load user profile
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
    const loadMCPTools = async () => {
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
    };
    loadMCPTools();
  }, []);

  const startConversation = useCallback(async () => {
    if (conversation.status === "connected") {
      console.warn("Conversation already connected.");
      return;
    }

    try {
      setIsLoadingUserData(true);

      // Format context using utility functions
      const preferencesContext = formatUserPreferencesContext(userPreferences);
      const contactsContext = formatContactsContext(userContacts);
      const toolsDescription = formatToolsDescription(availableTools);

      // Build enhanced system prompt
      const enhancedSystemPrompt = buildEnhancedSystemPrompt(
        CHIEF_SYSTEM_PROMPT,
        userFirstName,
        preferencesContext,
        contactsContext,
        toolsDescription
      );

      // Start the conversation with your agent
      await conversation.startSession({
        agentId: ELEVENLABS_AGENT_ID,
        dynamicVariables: {
          system_prompt: enhancedSystemPrompt,
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    } finally {
      setIsLoadingUserData(false);
    }
  }, [
    conversation,
    userFirstName,
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

  const isReady = !isLoadingUserData && !isLoadingTools;

  return {
    conversation,
    userFirstName,
    userPreferences,
    userContacts,
    availableTools,
    isLoadingUserData,
    isLoadingTools,
    startConversation,
    stopConversation,
    isReady,
  };
};
