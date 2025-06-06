
import { useState } from "react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, MessageSquare, FileText, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DataPage = () => {
  const { integrations, isConnected } = useIntegrations();
  const { toast } = useToast();
  const [customDocs, setCustomDocs] = useState<Array<{
    id: string;
    name: string;
    content: string;
    type: string;
    uploadedAt: string;
  }>>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newDoc = {
          id: crypto.randomUUID(),
          name: file.name,
          content: content,
          type: file.type,
          uploadedAt: new Date().toISOString()
        };
        setCustomDocs(prev => [...prev, newDoc]);
        toast({
          title: "Document uploaded",
          description: `${file.name} has been added to your data.`,
        });
      };
      reader.readAsText(file);
    }
  };

  const removeCustomDoc = (id: string) => {
    setCustomDocs(prev => prev.filter(doc => doc.id !== id));
    toast({
      title: "Document removed",
      description: "The document has been removed from your data.",
    });
  };

  const integrationData = [
    {
      type: 'gmail',
      icon: Mail,
      label: 'Gmail',
      color: 'text-red-500',
      connected: isConnected('gmail'),
      description: 'Email messages and attachments'
    },
    {
      type: 'calendar',
      icon: Calendar,
      label: 'Calendar',
      color: 'text-blue-500',
      connected: isConnected('calendar'),
      description: 'Events and meeting details'
    },
    {
      type: 'slack',
      icon: MessageSquare,
      label: 'Slack',
      color: 'text-green-500',
      connected: isConnected('slack'),
      description: 'Messages and channel content'
    }
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-semibold">Data Sources</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage data that powers your AI assistant
        </p>
      </div>

      <div className="p-6">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="custom">Custom Data</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-4">
            <div className="grid gap-4">
              {integrationData.map((integration) => {
                const Icon = integration.icon;
                return (
                  <Card key={integration.type} className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon size={24} className={integration.color} />
                          <div>
                            <CardTitle className="text-lg">{integration.label}</CardTitle>
                            <CardDescription className="text-gray-400">
                              {integration.description}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={integration.connected ? "default" : "secondary"}>
                          {integration.connected ? "Connected" : "Not Connected"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {integration.connected ? (
                        <div className="space-y-2">
                          <p className="text-sm text-green-400">
                            ✓ Data is being synced from this integration
                          </p>
                          <p className="text-xs text-gray-500">
                            Last sync: Real-time updates enabled
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-400">
                            Connect this integration to start collecting data
                          </p>
                          <p className="text-xs text-gray-500">
                            Go to Settings → Integrations to connect
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload size={20} />
                  <span>Upload Custom Documents</span>
                </CardTitle>
                <CardDescription>
                  Add your own text files, documents, or data for the AI to reference
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Upload a document</p>
                      <p className="text-xs text-gray-400">
                        Supports .txt, .md, .csv files
                      </p>
                    </div>
                    <Button className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                      Choose File
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".txt,.md,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {customDocs.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Uploaded Documents</CardTitle>
                  <CardDescription>
                    {customDocs.length} document{customDocs.length > 1 ? 's' : ''} available
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {customDocs.map((doc, index) => (
                      <div key={doc.id}>
                        <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText size={16} className="text-blue-400" />
                            <div>
                              <p className="text-sm font-medium">{doc.name}</p>
                              <p className="text-xs text-gray-400">
                                Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCustomDoc(doc.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        {index < customDocs.length - 1 && <Separator className="bg-gray-700" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DataPage;
