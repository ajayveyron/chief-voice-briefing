export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  auth?: {
    type: "none" | "api_key" | "bearer" | "basic";
    value?: string;
  };
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  serverId: string; // Which MCP server this tool belongs to
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
  serverId: string;
  toolName: string;
}

// Default MCP server configurations
export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: "local-tools",
    name: "Local Tools",
    description: "Built-in tools for vector search and data analysis",
    url: "https://xxccvppbxnhowncdhvdi.supabase.co/functions/v1",
    auth: {
      type: "bearer",
      value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4Y2N2cHBieG5ob3duY2RodmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMzQ2NjcsImV4cCI6MjA2NDcxMDY2N30.2oUeqsJA5_do6jsqzZfuzDv4fj9tr1Cl3cFvAXPOc_Q",
    },
    enabled: true, // Enable now that we have the MCP server
  },
  {
    id: "github-tools",
    name: "GitHub Tools",
    description: "GitHub integration tools",
    url: "https://api.github.com/mcp",
    auth: {
      type: "none",
    },
    enabled: false,
  },
  {
    id: "file-system",
    name: "File System",
    description: "Local file system operations",
    url: "http://localhost:3001/mcp",
    auth: {
      type: "none",
    },
    enabled: false,
  },
];

export class MCPConfigManager {
  private static instance: MCPConfigManager;
  private servers: Map<string, MCPServerConfig> = new Map();
  private tools: Map<string, MCPTool[]> = new Map();

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  private loadConfig() {
    // Load from localStorage or use defaults
    const savedServers = localStorage.getItem("mcp-servers");
    if (savedServers) {
      const parsed = JSON.parse(savedServers);
      parsed.forEach((server: MCPServerConfig) => {
        this.servers.set(server.id, server);
      });
    } else {
      // Use default servers
      DEFAULT_MCP_SERVERS.forEach((server) => {
        this.servers.set(server.id, server);
      });
      this.saveConfig();
    }
  }

  private saveConfig() {
    const serversArray = Array.from(this.servers.values());
    localStorage.setItem("mcp-servers", JSON.stringify(serversArray));
  }

  // Server management
  getServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  getServer(id: string): MCPServerConfig | undefined {
    return this.servers.get(id);
  }

  addServer(config: MCPServerConfig) {
    this.servers.set(config.id, config);
    this.saveConfig();
  }

  updateServer(id: string, updates: Partial<MCPServerConfig>) {
    const server = this.servers.get(id);
    if (server) {
      this.servers.set(id, { ...server, ...updates });
      this.saveConfig();
    }
  }

  removeServer(id: string) {
    this.servers.delete(id);
    this.tools.delete(id);
    this.saveConfig();
  }

  // Tool management
  getTools(): MCPTool[] {
    return Array.from(this.tools.values()).flat();
  }

  getToolsByServer(serverId: string): MCPTool[] {
    return this.tools.get(serverId) || [];
  }

  setTools(serverId: string, tools: MCPTool[]) {
    this.tools.set(serverId, tools);
  }

  // Get all enabled servers
  getEnabledServers(): MCPServerConfig[] {
    return this.getServers().filter((server) => server.enabled);
  }

  // Get all tools from enabled servers
  getEnabledTools(): MCPTool[] {
    return this.getEnabledServers()
      .map((server) => this.getToolsByServer(server.id))
      .flat();
  }
}
