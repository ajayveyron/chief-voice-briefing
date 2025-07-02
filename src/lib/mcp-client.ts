import {
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPConfigManager,
} from "./mcp-config";

export class MCPClient {
  private configManager: MCPConfigManager;

  constructor() {
    this.configManager = MCPConfigManager.getInstance();
  }

  /**
   * Discover and fetch tools from all enabled MCP servers
   */
  async discoverAllTools(): Promise<MCPTool[]> {
    const enabledServers = this.configManager.getEnabledServers();
    const allTools: MCPTool[] = [];

    for (const server of enabledServers) {
      try {
        console.log(`🔍 Discovering tools from ${server.name}...`);
        const tools = await this.discoverToolsFromServer(server);

        // Add server ID to each tool
        const toolsWithServerId = tools.map((tool) => ({
          ...tool,
          serverId: server.id,
        }));

        this.configManager.setTools(server.id, toolsWithServerId);
        allTools.push(...toolsWithServerId);

        console.log(`✅ Found ${tools.length} tools from ${server.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to discover tools from ${server.name}:`,
          error
        );
      }
    }

    return allTools;
  }

  /**
   * Discover tools from a specific MCP server
   */
  async discoverToolsFromServer(server: MCPServerConfig): Promise<MCPTool[]> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add authentication if configured
      if (server.auth) {
        switch (server.auth.type) {
          case "bearer":
            headers["Authorization"] = `Bearer ${server.auth.value}`;
            break;
          case "api_key":
            headers["X-API-Key"] = server.auth.value || "";
            break;
          case "basic":
            headers["Authorization"] = `Basic ${server.auth.value}`;
            break;
        }
      }

      const response = await fetch(`${server.url}/tools`, {
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
   * Execute a tool on a specific MCP server
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add authentication if configured
      if (server.auth) {
        switch (server.auth.type) {
          case "bearer":
            headers["Authorization"] = `Bearer ${server.auth.value}`;
            break;
          case "api_key":
            headers["X-API-Key"] = server.auth.value || "";
            break;
          case "basic":
            headers["Authorization"] = `Basic ${server.auth.value}`;
            break;
        }
      }

      const response = await fetch(`${server.url}/tools/${toolName}`, {
        method: "POST",
        headers,
        body: JSON.stringify(parameters),
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
   * Test connection to an MCP server
   */
  async testServerConnection(server: MCPServerConfig): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (server.auth) {
        switch (server.auth.type) {
          case "bearer":
            headers["Authorization"] = `Bearer ${server.auth.value}`;
            break;
          case "api_key":
            headers["X-API-Key"] = server.auth.value || "";
            break;
          case "basic":
            headers["Authorization"] = `Basic ${server.auth.value}`;
            break;
        }
      }

      const response = await fetch(`${server.url}/health`, {
        method: "GET",
        headers,
      });

      return response.ok;
    } catch (error) {
      console.error(`Failed to test connection to ${server.name}:`, error);
      return false;
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClient();
