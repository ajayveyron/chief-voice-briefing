import {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPConfigManager,
} from "./mcp-config";
import { supabase } from "@/integrations/supabase/client";

export class MCPClient {
  private configManager: MCPConfigManager;

  constructor() {
    this.configManager = MCPConfigManager.getInstance();
  }

  /**
   * Get the current user's JWT token
   */
  private async getUserToken(): Promise<string | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error("Failed to get user token:", error);
      return null;
    }
  }

  /**
   * Discover all tools from all enabled servers
   */
  async discoverAllTools(): Promise<MCPTool[]> {
    const enabledServers = this.configManager.getEnabledServers();
    const allTools: MCPTool[] = [];

    for (const server of enabledServers) {
      try {
        const tools = await this.discoverToolsFromServer(server);
        tools.forEach((tool) => {
          tool.serverId = server.id;
        });
        allTools.push(...tools);
        this.configManager.setTools(server.id, tools);
      } catch (error) {
        console.error(`Failed to discover tools from ${server.name}:`, error);
      }
    }

    return allTools;
  }

  /**
   * Discover tools from a specific MCP server (GET to root)
   */
  async discoverToolsFromServer(server: MCPServerConfig): Promise<MCPTool[]> {
    try {
      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("User not authenticated");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      };

      // GET to root for tool discovery
      const response = await fetch(`${server.url}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error(`Failed to discover tools from ${server.name}:`, error);
      return [];
    }
  }

  /**
   * Execute a tool on a specific MCP server (POST to root)
   */
  async executeTool(
    serverId: string,
    toolName: string,
    parameters: any
  ): Promise<MCPToolResult> {
    const server = this.configManager.getServer(serverId);
    if (!server) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
        serverId,
        toolName,
      };
    }

    try {
      const userToken = await this.getUserToken();
      if (!userToken) {
        return {
          success: false,
          error: "User not authenticated",
          serverId,
          toolName,
        };
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      };

      // POST to root for tool execution
      const response = await fetch(`${server.url}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ tool: toolName, parameters }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        result: result.data || result,
        serverId,
        toolName,
      };
    } catch (error) {
      console.error(
        `Failed to execute tool ${toolName} on server ${serverId}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        serverId,
        toolName,
      };
    }
  }

  /**
   * Get all available tools from all enabled servers
   */
  getAllTools(): MCPTool[] {
    return this.configManager.getEnabledTools();
  }

  /**
   * Get tools from a specific server
   */
  getToolsByServer(serverId: string): MCPTool[] {
    return this.configManager.getToolsByServer(serverId);
  }

  /**
   * Get a formatted description of all available tools
   */
  getToolsDescription(): string {
    const tools = this.getAllTools();

    if (tools.length === 0) {
      return "No tools are currently available.";
    }

    // Group tools by server
    const toolsByServer = tools.reduce((acc, tool) => {
      if (!acc[tool.serverId]) {
        acc[tool.serverId] = [];
      }
      acc[tool.serverId].push(tool);
      return acc;
    }, {} as Record<string, MCPTool[]>);

    let description = "Available tools:\n\n";

    for (const [serverId, serverTools] of Object.entries(toolsByServer)) {
      const server = this.configManager.getServer(serverId);
      description += `${server?.name || serverId}:\n`;

      serverTools.forEach((tool) => {
        const requiredParams = tool.inputSchema.required.join(", ");
        const optionalParams = Object.keys(tool.inputSchema.properties)
          .filter((key) => !tool.inputSchema.required.includes(key))
          .join(", ");

        let paramsDesc = `Required: ${requiredParams}`;
        if (optionalParams) {
          paramsDesc += ` | Optional: ${optionalParams}`;
        }

        description += `  - ${tool.name}: ${tool.description} (${paramsDesc})\n`;
      });

      description += "\n";
    }

    return description;
  }

  /**
   * Suggest tools based on user input
   */
  suggestTools(userInput: string): MCPTool[] {
    const tools = this.getAllTools();
    const suggestions: MCPTool[] = [];

    const input = userInput.toLowerCase();

    for (const tool of tools) {
      const toolName = tool.name.toLowerCase();
      const description = tool.description.toLowerCase();

      // Check if user input matches tool name or description
      if (
        input.includes(toolName.replace("_", " ")) ||
        input.includes(toolName.replace("_", "")) ||
        description.split(" ").some((word) => input.includes(word))
      ) {
        suggestions.push(tool);
      }
    }

    return suggestions;
  }

  /**
   * Test connection to an MCP server (GET to root)
   */
  async testServerConnection(server: MCPServerConfig): Promise<boolean> {
    try {
      const userToken = await this.getUserToken();
      if (!userToken) {
        return false;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      };

      // GET to root for health check
      const response = await fetch(`${server.url}`, {
        method: "GET",
        headers,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClient();
