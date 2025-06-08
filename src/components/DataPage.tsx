
import React, { useState } from "react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, MessageSquare, FileText, Upload, Trash2, File, Image, FileSpreadsheet, RefreshCw, Users, Hash } from "lucide-react";
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
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [slackData, setSlackData] = useState<any>(null);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSlack, setLoadingSlack] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('spreadsheet') || type.includes('csv')) return FileSpreadsheet;
    return File;
  };

  const fetchGmailEmails = async () => {
    setLoadingGmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No session');

      const { data, error } = await supabase.functions.invoke('fetch-gmail-emails', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) throw error;
      setGmailEmails(data.emails || []);
      toast({
        title: "Gmail emails fetched",
        description: `Retrieved ${data.emails?.length || 0} recent emails`
      });
    } catch (error) {
      console.error('Error fetching Gmail emails:', error);
      toast({
        title: "Failed to fetch emails",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingGmail(false);
    }
  };

const fetchCalendarEvents = async () => {
  setLoadingCalendar(true);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('No session');

    const { data, error } = await supabase.functions.invoke('fetch-calendar-events', {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`
      }
    });

    if (error) throw error;

    setCalendarEvents(data.events || []);
    toast({
      title: "Calendar events fetched",
      description: `Retrieved ${data.events?.length || 0} recent events`
    });
  } catch (error: any) {
    console.error('Error fetching Calendar events:', error);
    toast({
      title: "Failed to fetch calendar events",
      description: error.message || "Calendar integration failed",
      variant: "destructive"
    });
  } finally {
    setLoadingCalendar(false);
  }
};

 const fetchSlackData = async () => {
  setLoadingSlack(true);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw new Error('No session');

    const { data, error } = await supabase.functions.invoke('fetch-slack-messages', {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`
      }
    });

    if (error) throw error;

    setSlackData(data);
    toast({
      title: "Slack data fetched",
      description: `Retrieved comprehensive data: ${data.summary?.total_channels || 0} channels, ${data.summary?.total_messages || 0} messages, ${data.summary?.total_users || 0} users`
    });
  } catch (error: any) {
    console.error('Error fetching Slack data:', error);
    toast({
      title: "Failed to fetch slack data",
      description: error.message || "Slack integration failed",
      variant: "destructive"
    });
  } finally {
    setLoadingSlack(false);
  }
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
        .from('user_documents')
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
        .from('user_documents')
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
      description: 'Email messages and attachments',
      fetchFunction: fetchGmailEmails,
      loading: loadingGmail,
      data: gmailEmails,
      dataLabel: 'emails'
    },
    {
      type: 'calendar',
      icon: Calendar,
      label: 'Calendar',
      color: 'text-blue-500',
      connected: isConnected('calendar'),
      description: 'Events and meeting details',
      fetchFunction: fetchCalendarEvents,
      loading: loadingCalendar,
      data: calendarEvents,
      dataLabel: 'events'
    },
    {
      type: 'slack',
      icon: MessageSquare,
      label: 'Slack',
      color: 'text-green-500',
      connected: isConnected('slack'),
      description: 'Messages, channels, users, and team data',
      fetchFunction: fetchSlackData,
      loading: loadingSlack,
      data: slackData,
      dataLabel: 'comprehensive data'
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
                        <div className="space-y-3">
                          <p className="text-sm text-green-400">
                            ✓ Data is being synced from this integration
                          </p>
                          
                          <div className="space-y-3">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={integration.fetchFunction}
                              disabled={integration.loading}
                            >
                              {integration.loading ? <RefreshCw className="animate-spin h-4 w-4 mr-2" /> : <Icon className="h-4 w-4 mr-2" />}
                              {integration.loading ? 'Loading...' : `Fetch Recent ${integration.label} Data`}
                            </Button>
                            
                            {/* Gmail Data Display */}
                            {integration.type === 'gmail' && integration.data.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-gray-400">Recent emails:</p>
                                {integration.data.map((item, index) => (
                                  <div key={item.id || index} className="p-2 bg-gray-900 rounded text-xs">
                                    <div className="font-medium text-gray-200">{item.subject}</div>
                                    <div className="text-gray-400">From: {item.from}</div>
                                    <div className="text-gray-500 mt-1">{item.snippet}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Calendar Data Display */}
                            {integration.type === 'calendar' && integration.data.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-gray-400">Recent events:</p>
                                {integration.data.map((item, index) => (
                                  <div key={item.id || index} className="p-2 bg-gray-900 rounded text-xs">
                                    <div className="font-medium text-gray-200">{item.summary}</div>
                                    <div className="text-gray-400">Start: {new Date(item.start).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Slack Data Display */}
                            {integration.type === 'slack' && integration.data && (
                              <div className="mt-3 space-y-3">
                                {/* Team Info */}
                                {integration.data.team && (
                                  <div className="p-3 bg-gray-900 rounded">
                                    <p className="text-xs text-gray-400 mb-2">Team Info:</p>
                                    <div className="text-xs">
                                      <div className="font-medium text-gray-200">{integration.data.team.name}</div>
                                      <div className="text-gray-400">{integration.data.team.domain}</div>
                                    </div>
                                  </div>
                                )}

                                {/* Summary */}
                                {integration.data.summary && (
                                  <div className="p-3 bg-gray-900 rounded">
                                    <p className="text-xs text-gray-400 mb-2">Data Summary:</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="flex items-center space-x-1">
                                        <Hash size={12} />
                                        <span>{integration.data.summary.total_channels} channels</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Users size={12} />
                                        <span>{integration.data.summary.total_users} users</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <MessageSquare size={12} />
                                        <span>{integration.data.summary.total_messages} messages</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Recent Messages */}
                                {integration.data.messages && integration.data.messages.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Recent messages:</p>
                                    {integration.data.messages.slice(0, 3).map((message, index) => (
                                      <div key={message.id || index} className="p-2 bg-gray-900 rounded text-xs">
                                        <div className="font-medium text-gray-200">{message.text}</div>
                                        <div className="text-gray-400">From: {message.user} in {message.channel}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Channels */}
                                {integration.data.channels && integration.data.channels.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Available channels:</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {integration.data.channels.slice(0, 5).map((channel, index) => (
                                        <div key={channel.id || index} className="p-2 bg-gray-900 rounded text-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-200">#{channel.name}</span>
                                            <Badge variant={channel.is_member ? "default" : "secondary"} className="text-xs">
                                              {channel.is_member ? "Member" : "Not Member"}
                                            </Badge>
                                          </div>
                                          {channel.purpose && (
                                            <div className="text-gray-500 mt-1">{channel.purpose}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
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
