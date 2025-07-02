import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { mcpClient } from "@/lib/mcp-client";
import { MCPServerConfig, MCPConfigManager, MCPTool } from "@/lib/mcp-config";
import {
  Plus,
  Settings,
  TestTube,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function MCPServerManager() {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServer, setNewServer] = useState<Partial<MCPServerConfig>>({
    name: "",
    description: "",
    url: "",
    auth: { type: "none" },
    enabled: true,
  });
  const { toast } = useToast();

  const configManager = MCPConfigManager.getInstance();

  useEffect(() => {
    loadServers();
    loadTools();
  }, []);

  const loadServers = () => {
    setServers(configManager.getServers());
  };

  const loadTools = () => {
    setTools(configManager.getEnabledTools());
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const serverConfig: MCPServerConfig = {
        id: `server-${Date.now()}`,
        name: newServer.name!,
        description: newServer.description || "",
        url: newServer.url!,
        auth: newServer.auth || { type: "none" },
        enabled: newServer.enabled || false,
      };

      configManager.addServer(serverConfig);
      loadServers();

      // Test connection
      const isConnected = await mcpClient.testServerConnection(serverConfig);
      if (isConnected) {
        toast({
          title: "Server Added",
          description: `${serverConfig.name} added successfully and connection tested`,
        });

        // Discover tools if connection successful
        if (serverConfig.enabled) {
          await discoverTools();
        }
      } else {
        toast({
          title: "Server Added",
          description: `${serverConfig.name} added but connection test failed`,
          variant: "destructive",
        });
      }

      setNewServer({
        name: "",
        description: "",
        url: "",
        auth: { type: "none" },
        enabled: true,
      });
      setIsAddingServer(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    configManager.updateServer(serverId, { enabled });
    loadServers();

    if (enabled) {
      // Discover tools when enabling server
      await discoverTools();
    } else {
      // Remove tools when disabling server
      configManager.setTools(serverId, []);
      loadTools();
    }
  };

  const handleDeleteServer = (serverId: string) => {
    configManager.removeServer(serverId);
    loadServers();
    loadTools();
    toast({
      title: "Server Removed",
      description: "MCP server has been removed",
    });
  };

  const discoverTools = async () => {
    setIsLoading(true);
    try {
      const discoveredTools = await mcpClient.discoverAllTools();
      setTools(discoveredTools);
      toast({
        title: "Tools Discovered",
        description: `Found ${discoveredTools.length} tools from all servers`,
      });
    } catch (error) {
      toast({
        title: "Discovery Error",
        description: "Failed to discover tools from some servers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (server: MCPServerConfig) => {
    setIsLoading(true);
    try {
      const isConnected = await mcpClient.testServerConnection(server);
      toast({
        title: "Connection Test",
        description: isConnected
          ? "Connection successful"
          : "Connection failed",
        variant: isConnected ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Connection Test",
        description: "Connection test failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getToolsByServer = (serverId: string) => {
    return tools.filter((tool) => tool.serverId === serverId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Servers</h2>
          <p className="text-muted-foreground">
            Manage Model Context Protocol servers and their tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={discoverTools}
            disabled={isLoading}
            variant="outline"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Discover Tools
          </Button>
          <Dialog open={isAddingServer} onOpenChange={setIsAddingServer}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add MCP Server</DialogTitle>
                <DialogDescription>
                  Configure a new MCP server to connect to
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newServer.name}
                    onChange={(e) =>
                      setNewServer({ ...newServer, name: e.target.value })
                    }
                    placeholder="My MCP Server"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newServer.description}
                    onChange={(e) =>
                      setNewServer({
                        ...newServer,
                        description: e.target.value,
                      })
                    }
                    placeholder="Description of this server"
                  />
                </div>
                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={newServer.url}
                    onChange={(e) =>
                      setNewServer({ ...newServer, url: e.target.value })
                    }
                    placeholder="https://api.example.com/mcp"
                  />
                </div>
                <div>
                  <Label htmlFor="auth">Authentication</Label>
                  <Select
                    value={newServer.auth?.type}
                    onValueChange={(value) =>
                      setNewServer({
                        ...newServer,
                        auth: { type: value as any, value: "" },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newServer.auth?.type !== "none" && (
                  <div>
                    <Label htmlFor="authValue">Auth Value</Label>
                    <Input
                      id="authValue"
                      type="password"
                      value={newServer.auth?.value}
                      onChange={(e) =>
                        setNewServer({
                          ...newServer,
                          auth: { ...newServer.auth!, value: e.target.value },
                        })
                      }
                      placeholder="Enter authentication value"
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={newServer.enabled}
                    onCheckedChange={(checked) =>
                      setNewServer({ ...newServer, enabled: checked })
                    }
                  />
                  <Label htmlFor="enabled">Enable server</Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddServer} disabled={isLoading}>
                    Add Server
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingServer(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {servers.map((server) => (
          <Card key={server.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {server.name}
                    <Badge variant={server.enabled ? "default" : "secondary"}>
                      {server.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{server.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection(server)}
                    disabled={isLoading}
                  >
                    <TestTube className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteServer(server.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Server URL</p>
                    <p className="text-sm text-muted-foreground">
                      {server.url}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`enabled-${server.id}`}>Enable</Label>
                    <Switch
                      id={`enabled-${server.id}`}
                      checked={server.enabled}
                      onCheckedChange={(enabled) =>
                        handleToggleServer(server.id, enabled)
                      }
                    />
                  </div>
                </div>

                {server.enabled && (
                  <div>
                    <p className="text-sm font-medium mb-2">Available Tools</p>
                    <div className="space-y-2">
                      {getToolsByServer(server.id).length > 0 ? (
                        getToolsByServer(server.id).map((tool) => (
                          <div
                            key={tool.name}
                            className="flex items-center justify-between p-2 bg-muted rounded"
                          >
                            <div>
                              <p className="text-sm font-medium">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {tool.description}
                              </p>
                            </div>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No tools discovered
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No MCP Servers</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first MCP server to start discovering and using tools
            </p>
            <Button onClick={() => setIsAddingServer(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Server
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
