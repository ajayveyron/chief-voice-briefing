import React, { useState } from "react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Calendar, MessageSquare, FileText, Upload, Trash2, File, Image, FileSpreadsheet, RefreshCw, Users, Hash, Lock, Globe, Eye, Clock } from "lucide-react";
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
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);

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
        title: "Slack channels fetched",
        description: `Retrieved ${data.summary?.total_channels || 0} channels, ${data.summary?.channels_with_recent_activity || 0} with recent activity`
      });
    } catch (error: any) {
      console.error('Error fetching Slack data:', error);
      toast({
        title: "Failed to fetch slack channels",
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

  const handleChannelClick = (channel: any) => {
    setSelectedChannel(channel);
    setIsChannelDialogOpen(true);
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
      description: 'Channels ordered by most recent activity',
      fetchFunction: fetchSlackData,
      loading: loadingSlack,
      data: slackData,
      dataLabel: 'channels by recent activity'
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
                            <CardTitle className="text-lg text-white">{integration.label}</CardTitle>
                            <CardDescription className="text-gray-300">
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
                                <p className="text-sm font-medium text-white">Recent emails:</p>
                                {integration.data.map((item, index) => (
                                  <div key={item.id || index} className="p-3 bg-gray-900 rounded-lg border border-gray-600">
                                    <div className="font-medium text-white">{item.subject}</div>
                                    <div className="text-gray-200 text-sm">From: {item.from}</div>
                                    <div className="text-gray-300 text-sm mt-1">{item.snippet}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Calendar Data Display */}
                            {integration.type === 'calendar' && integration.data.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-sm font-medium text-white">Recent events:</p>
                                {integration.data.map((item, index) => (
                                  <div key={item.id || index} className="p-3 bg-gray-900 rounded-lg border border-gray-600">
                                    <div className="font-medium text-white">{item.summary}</div>
                                    <div className="text-gray-200 text-sm">Start: {new Date(item.start).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Slack Channels Display - Ordered by Recent Activity */}
                            {integration.type === 'slack' && integration.data && (
                              <div className="mt-3 space-y-3">
                                {/* Summary */}
                                {integration.data.summary && (
                                  <div className="p-4 bg-gray-900 rounded-lg border border-gray-600">
                                    <p className="text-sm font-medium text-white mb-3">Channels Summary:</p>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="flex items-center space-x-2">
                                        <Hash size={14} className="text-gray-300" />
                                        <span className="text-white text-sm">{integration.data.summary.total_channels} total</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Users size={14} className="text-gray-300" />
                                        <span className="text-white text-sm">{integration.data.summary.member_channels} member</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Clock size={14} className="text-gray-300" />
                                        <span className="text-white text-sm">{integration.data.summary.channels_with_recent_activity} active</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Channels - Ordered by Recent Activity */}
                                {integration.data.channels && integration.data.channels.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-white">Channels (ordered by most recent activity):</p>
                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                      {integration.data.channels.map((channel, index) => (
                                        <div 
                                          key={channel.id || index} 
                                          className="p-3 bg-gray-900 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-800 transition-colors"
                                          onClick={() => handleChannelClick(channel)}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                              {channel.is_private ? <Lock size={14} className="text-gray-400" /> : <Globe size={14} className="text-gray-400" />}
                                              <span className="font-medium text-white text-sm">#{channel.name}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <Badge 
                                                variant={channel.is_member ? "default" : "secondary"} 
                                                className={`text-xs ${channel.is_member ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}
                                              >
                                                {channel.is_member ? "Member" : "Not Member"}
                                              </Badge>
                                              {channel.num_members && (
                                                <span className="text-xs text-gray-400">{channel.num_members} members</span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {channel.latest_message_date && (
                                            <div className="flex items-center space-x-2 mb-1">
                                              <Clock size={12} className="text-green-400" />
                                              <span className="text-xs text-green-400">
                                                Last activity: {new Date(channel.latest_message_date).toLocaleString()}
                                              </span>
                                            </div>
                                          )}
                                          
                                          {!channel.latest_message_date && channel.is_member && (
                                            <div className="flex items-center space-x-2 mb-1">
                                              <Clock size={12} className="text-gray-500" />
                                              <span className="text-xs text-gray-500">No recent messages</span>
                                            </div>
                                          )}
                                          
                                          {channel.purpose && (
                                            <div className="text-gray-300 text-xs mt-1">{channel.purpose}</div>
                                          )}
                                          {channel.topic && (
                                            <div className="text-gray-400 text-xs mt-1">Topic: {channel.topic}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-400">
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

      {/* Channel Details Dialog */}
      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-600 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedChannel?.is_private ? <Lock size={20} className="text-gray-400" /> : <Globe size={20} className="text-gray-400" />}
              <span>#{selectedChannel?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Complete channel information from Slack API
            </DialogDescription>
          </DialogHeader>
          
          {selectedChannel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-white mb-2">Basic Info</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-400">ID:</span> <span className="text-gray-200">{selectedChannel.id}</span></div>
                    <div><span className="text-gray-400">Name:</span> <span className="text-gray-200">#{selectedChannel.name}</span></div>
                    <div><span className="text-gray-400">Type:</span> <span className="text-gray-200">{selectedChannel.is_private ? 'Private' : 'Public'} Channel</span></div>
                    <div><span className="text-gray-400">Members:</span> <span className="text-gray-200">{selectedChannel.num_members || 'Unknown'}</span></div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-2">Activity</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-400">Member Status:</span> 
                      <Badge className={`ml-2 ${selectedChannel.is_member ? 'bg-green-600' : 'bg-red-600'}`}>
                        {selectedChannel.is_member ? 'Member' : 'Not Member'}
                      </Badge>
                    </div>
                    {selectedChannel.latest_message_date && (
                      <div><span className="text-gray-400">Last Activity:</span> <span className="text-green-400">{new Date(selectedChannel.latest_message_date).toLocaleString()}</span></div>
                    )}
                    {!selectedChannel.latest_message_date && (
                      <div><span className="text-gray-400">Last Activity:</span> <span className="text-gray-500">No recent messages</span></div>
                    )}
                  </div>
                </div>
              </div>

              {selectedChannel.purpose && (
                <div>
                  <h4 className="font-medium text-white mb-2">Purpose</h4>
                  <p className="text-gray-200 text-sm bg-gray-900 p-3 rounded border border-gray-600">
                    {selectedChannel.purpose}
                  </p>
                </div>
              )}

              {selectedChannel.topic && (
                <div>
                  <h4 className="font-medium text-white mb-2">Topic</h4>
                  <p className="text-gray-200 text-sm bg-gray-900 p-3 rounded border border-gray-600">
                    {selectedChannel.topic}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-medium text-white mb-2">Raw Channel Data</h4>
                <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded border border-gray-600 overflow-x-auto">
                  {JSON.stringify(selectedChannel, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataPage;
