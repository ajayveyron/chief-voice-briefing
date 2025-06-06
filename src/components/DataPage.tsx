
import React, { useState } from "react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, MessageSquare, FileText, Upload, Trash2, File, Image, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserDocuments } from "@/hooks/useUserDocuments";

const DataPage = () => {
  const { integrations, isConnected } = useIntegrations();
  const { toast } = useToast();
  const { user } = useAuth();
  const { documents, refetch } = useUserDocuments();
  const [isUploading, setIsUploading] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('spreadsheet') || type.includes('csv')) return FileSpreadsheet;
    return File;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      let content = '';
      
      // Handle different file types
      if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.csv')) {
        // Text-based files
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else if (file.type === 'application/pdf') {
        // For PDFs, we'll store metadata and note that content extraction needs implementation
        content = `PDF file: ${file.name} (${file.size} bytes). Content extraction not yet implemented - please convert to text format for now.`;
      } else if (file.type.startsWith('image/')) {
        // For images, we'll store metadata
        content = `Image file: ${file.name} (${file.size} bytes). Image analysis not yet implemented.`;
      } else {
        content = `File: ${file.name} (${file.size} bytes, ${file.type}). Content extraction not supported for this file type.`;
      }

      // Store in Supabase
      const { data, error } = await supabase
        .from('user_documents' as any)
        .insert([
          {
            user_id: user.id,
            name: file.name,
            content: content,
            file_type: file.type,
            file_size: file.size
          }
        ])
        .select()
        .single();

      if (error) throw error;

      await refetch();
      toast({
        title: "Document uploaded",
        description: `${file.name} has been added to your data.`
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const removeCustomDoc = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_documents' as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await refetch();
      toast({
        title: "Document removed",
        description: "The document has been removed from your data."
      });
    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: "Removal failed",
        description: "There was an error removing the document.",
        variant: "destructive"
      });
    }
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
          <TabsList className="grid w-full grid-cols-2 bg-gray-700">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="custom">Custom Data</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-4">
            <div className="grid gap-4">
              {integrationData.map(integration => {
                const Icon = integration.icon;
                return (
                  <Card key={integration.type} className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon size={24} className={integration.color} />
                          <div>
                            <CardTitle className="text-lg text-gray-50">{integration.label}</CardTitle>
                            <CardDescription className="text-gray-400">
                              {integration.description}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={integration.connected ? "default" : "secondary"} className="px-0 mx-0">
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
                <CardTitle className="flex items-center space-x-2 text-zinc-50">
                  <Upload size={20} />
                  <span>Upload Custom Documents</span>
                </CardTitle>
                <CardDescription>
                  Add PDFs, images, text files, spreadsheets, or other documents for the AI to reference
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-zinc-50">Upload a document</p>
                      <p className="text-xs text-gray-400">
                        Supports .txt, .md, .csv, .pdf, .json, images, and more
                      </p>
                    </div>
                    <Button 
                      className="mt-4" 
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Choose File'}
                    </Button>
                    <input 
                      id="file-upload" 
                      type="file" 
                      accept=".txt,.md,.csv,.pdf,.json,.doc,.docx,image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {documents.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Uploaded Documents</CardTitle>
                  <CardDescription>
                    {documents.length} document{documents.length > 1 ? 's' : ''} available for AI reference
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.map((doc, index) => {
                      const FileIcon = getFileIcon(doc.file_type);
                      return (
                        <div key={doc.id}>
                          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileIcon size={16} className="text-blue-400" />
                              <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <p className="text-xs text-gray-400">
                                  Uploaded {new Date(doc.created_at).toLocaleDateString()} • {doc.file_type}
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
                          {index < documents.length - 1 && <Separator className="bg-gray-700" />}
                        </div>
                      );
                    })}
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
