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

  // Create client tools for MCP tool execution
  const createClientTools = useCallback(() => {
    const clientTools: Record<string, (params: any) => Promise<any>> = {};

    console.log(
      "🔧 Creating client tools for",
      availableTools.length,
      "MCP tools:",
      availableTools.map((t) => t.name)
    );

    availableTools.forEach((tool) => {
      clientTools[tool.name] = async (params: any) => {
        console.log(`🚀 CLIENT TOOL CALLED: ${tool.name}`);
        console.log(`📋 Parameters received:`, params);
        console.log(`⏰ Timestamp:`, new Date().toISOString());

        try {
          // Find the server that has this tool
          const allServers = mcpClient["configManager"].getServers();
          console.log(
            `🔍 Looking for tool ${tool.name} in ${allServers.length} servers`
          );

          const serverWithTool = allServers.find((server) =>
            mcpClient["configManager"]
              .getToolsByServer(server.id)
              .some((t) => t.name === tool.name)
          );

          if (!serverWithTool) {
            console.error(`❌ No server found for tool: ${tool.name}`);
            throw new Error(`No server found for tool: ${tool.name}`);
          }

          console.log(
            `✅ Found tool ${tool.name} on server: ${serverWithTool.name} (${serverWithTool.id})`
          );
          console.log(`🔧 Executing MCP tool via client:`, {
            serverId: serverWithTool.id,
            toolName: tool.name,
            parameters: params,
          });

          // Execute the tool using MCP client
          const result = await mcpClient.executeTool(
            serverWithTool.id,
            tool.name,
            params
          );

          console.log(`📤 MCP tool execution result:`, result);

          if (result.success) {
            console.log(`✅ Tool ${tool.name} executed successfully`);
            console.log(`📊 Result data:`, result.result);

            const response = {
              success: true,
              data: result.result,
              message: `Successfully executed ${tool.name}`,
              timestamp: new Date().toISOString(),
            };

            console.log(`📤 Returning to ElevenLabs:`, response);
            return response;
          } else {
            console.error(`❌ Tool ${tool.name} failed:`, result.error);

            const errorResponse = {
              success: false,
              error: result.error,
              message: `Failed to execute ${tool.name}: ${result.error}`,
              timestamp: new Date().toISOString(),
            };

            console.log(`📤 Returning error to ElevenLabs:`, errorResponse);
            return errorResponse;
          }
        } catch (error) {
          console.error(`💥 Exception in tool ${tool.name}:`, error);
          console.error(
            `📚 Error stack:`,
            error instanceof Error ? error.stack : "No stack trace"
          );

          const exceptionResponse = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            message: `Error executing ${tool.name}`,
            timestamp: new Date().toISOString(),
          };

          console.log(
            `📤 Returning exception to ElevenLabs:`,
            exceptionResponse
          );
          return exceptionResponse;
        }
      };
    });

    console.log(
      `✅ Created ${Object.keys(clientTools).length} client tools:`,
      Object.keys(clientTools)
    );
    return clientTools;
  }, [availableTools]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("🔗 Connected to ElevenLabs");
      console.log(
        "🛠️ Available tools at connection:",
        availableTools.map((t) => t.name)
      );
    },
    onDisconnect: () => {
      console.log("🔌 Disconnected from ElevenLabs");
    },
    onMessage: (message) => {
      console.log("📨 ElevenLabs message:", message);
    },
    onError: (error) => {
      console.error("🚨 ElevenLabs error:", error);
    },
    clientTools: createClientTools(),
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
      console.warn("⚠️ Conversation already connected.");
      return;
    }

    try {
      console.log("🚀 Starting conversation...");
      console.log("👤 User first name:", userFirstName);
      console.log(
        "🛠️ Available tools:",
        availableTools.length,
        availableTools.map((t) => t.name)
      );

      setIsLoadingUserData(true);

      // Format context using utility functions
      const preferencesContext = formatUserPreferencesContext(userPreferences);
      const contactsContext = formatContactsContext(userContacts);
      const toolsDescription = formatToolsDescription(availableTools);

      console.log("📝 Tools description being sent:", toolsDescription);

      // Build enhanced system prompt
      const enhancedSystemPrompt = buildEnhancedSystemPrompt(
        CHIEF_SYSTEM_PROMPT,
        userFirstName,
        preferencesContext,
        contactsContext,
        toolsDescription
      );

      console.log(
        "🎯 Enhanced system prompt (first 500 chars):",
        enhancedSystemPrompt.substring(0, 500) + "..."
      );
      console.log(
        "🔧 Client tools being registered:",
        Object.keys(createClientTools())
      );

      // Start the conversation with your agent
      await conversation.startSession({
        agentId: ELEVENLABS_AGENT_ID,
        dynamicVariables: {
          system_prompt: enhancedSystemPrompt,
        },
      });

      console.log("✅ Conversation session started successfully");
    } catch (error) {
      console.error("❌ Failed to start conversation:", error);
      console.error(
        "📚 Error details:",
        error instanceof Error ? error.stack : "No stack trace"
      );
    } finally {
      setIsLoadingUserData(false);
    }
  }, [
    conversation,
    userFirstName,
    userPreferences,
    userContacts,
    availableTools,
    createClientTools,
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
