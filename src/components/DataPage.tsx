import React, { useState } from "react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mail, Calendar, MessageSquare, FileText, Upload, Trash2, File, Image, FileSpreadsheet, RefreshCw, Users, Hash, Lock, Globe, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserDocuments } from "@/hooks/useUserDocuments";
const DataPage = () => {
  const {
    integrations,
    isConnected
  } = useIntegrations();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const {
    documents,
    refetch
  } = useUserDocuments();
  const [isUploading, setIsUploading] = useState(false);
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [slackData, setSlackData] = useState<any>(null);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSlack, setLoadingSlack] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, Date>>({});
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('spreadsheet') || type.includes('csv')) return FileSpreadsheet;
    return File;
  };
  const fetchGmailEmails = async () => {
    setLoadingGmail(true);
    try {
      const {
        data: sessionData
      } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No session');
      const {
        data,
        error
      } = await supabase.functions.invoke('fetch-gmail-emails', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });
      if (error) throw error;
      setGmailEmails(data.emails || []);
      setLastSyncTimes(prev => ({
        ...prev,
        gmail: new Date()
      }));
      toast({
        title: "Gmail synced successfully",
        description: `Retrieved ${data.emails?.length || 0} recent emails`
      });
    } catch (error) {
      console.error('Error syncing Gmail emails:', error);
      toast({
        title: "Failed to sync emails",
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
      const {
        data: sessionData
      } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No session');
      const {
        data,
        error
      } = await supabase.functions.invoke('fetch-calendar-events', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });
      if (error) throw error;
      setCalendarEvents(data.events || []);
      setLastSyncTimes(prev => ({
        ...prev,
        calendar: new Date()
      }));
      toast({
        title: "Calendar synced successfully",
        description: `Retrieved ${data.events?.length || 0} recent events`
      });
    } catch (error: any) {
      console.error('Error syncing Calendar events:', error);
      toast({
        title: "Failed to sync calendar events",
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
      const {
        data: sessionData
      } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('No session');
      const {
        data,
        error
      } = await supabase.functions.invoke('fetch-slack-messages', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });
      if (error) throw error;
      setSlackData(data);
      setLastSyncTimes(prev => ({
        ...prev,
        slack: new Date()
      }));
      toast({
        title: "Slack synced successfully",
        description: `Retrieved comprehensive data: ${data.summary?.total_channels || 0} channels, ${data.summary?.total_messages || 0} messages, ${data.summary?.total_users || 0} users`
      });
    } catch (error: any) {
      console.error('Error syncing Slack data:', error);
      toast({
        title: "Failed to sync slack data",
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
      if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else if (file.type === 'application/pdf') {
        content = `PDF file: ${file.name} (${file.size} bytes). Content extraction not yet implemented - please convert to text format for now.`;
      } else if (file.type.startsWith('image/')) {
        content = `Image file: ${file.name} (${file.size} bytes). Image analysis not yet implemented.`;
      } else {
        content = `File: ${file.name} (${file.size} bytes, ${file.type}). Content extraction not supported for this file type.`;
      }
      const {
        data,
        error
      } = await supabase.from('user_documents').insert([{
        user_id: user.id,
        name: file.name,
        content: content,
        file_type: file.type,
        file_size: file.size
      }]).select().single();
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
      event.target.value = '';
    }
  };
  const removeCustomDoc = async (id: string) => {
    if (!user) return;
    try {
      const {
        error
      } = await supabase.from('user_documents').delete().eq('id', id).eq('user_id', user.id);
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
  const getSummaryText = (type: string) => {
    switch (type) {
      case 'gmail':
        return gmailEmails.length > 0 ? `${gmailEmails.length} emails synced` : 'No data synced yet';
      case 'calendar':
        return calendarEvents.length > 0 ? `${calendarEvents.length} events synced` : 'No data synced yet';
      case 'slack':
        return slackData ? `${slackData.summary?.total_channels || 0} channels, ${slackData.summary?.total_messages || 0} messages` : 'No data synced yet';
      default:
        return 'No data synced yet';
    }
  };
  const integrationData = [{
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
  }, {
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
  }, {
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
  }];
  return <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-50">Data Sources</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage data that powers your AI assistant
        </p>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger value="integrations" className="text-xs sm:text-sm">Integrations</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs sm:text-sm">Custom Data</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-4 mt-4">
            <Accordion type="single" collapsible className="w-full space-y-4">
              {integrationData.map(integration => {
              const Icon = integration.icon;
              const lastSync = lastSyncTimes[integration.type];
              return <AccordionItem key={integration.type} value={integration.type} className="rounded-lg bg-gray-900 px-px">
                    <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline bg-gray-900 hover:bg-gray-800 w-10 ">
                      <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <Icon size={20} className={integration.color} />
                          <div className="min-w-0 text-left flex-1">
                            <div className="text-base sm:text-lg text-card-background font-semibold truncate ">{integration.label}</div>
                            <div className="text-muted-foreground text-xs sm:text-sm truncate">
                              {integration.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 shrink-0">
  <div className="flex items-center space-x-2">
    {integration.connected ? (
      <CheckCircle size={16} className="text-green-500 shrink-0" />
    ) : (
      <AlertCircle size={16} className="text-red-500 shrink-0" />
    )}
    <div className="text-xs text-muted-foreground whitespace-nowrap">
      {integration.connected
        ? getSummaryText(integration.type)
        : 'Connect to sync data'}
    </div>
  </div>
</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4">
                      {integration.connected ? <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <Button size="sm" variant="default" onClick={integration.fetchFunction} disabled={integration.loading} className="w-full sm:w-auto text-xs sm:text-sm">
                              {integration.loading ? <RefreshCw className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-2" /> : <Icon className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />}
                              {integration.loading ? 'Syncing...' : `Sync ${integration.label} Data`}
                            </Button>
                            
                            {lastSync && <p className="text-xs text-muted-foreground">
                                Last synced: {lastSync.toLocaleString()}
                              </p>}
                          </div>
                          
                          <div className="overflow-hidden">
                            {/* Gmail Data Display */}
                            {integration.type === 'gmail' && integration.data.length > 0 && <div className="space-y-2">
                                <p className="text-xs sm:text-sm font-medium text-card-foreground">Recent emails:</p>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {integration.data.map((item, index) => <div key={item.id || index} className="p-3 bg-muted rounded-lg border border-border">
                                      <div className="font-medium text-card-foreground text-sm break-words">{item.subject}</div>
                                      <div className="text-muted-foreground text-xs break-words">From: {item.from}</div>
                                      <div className="text-muted-foreground text-xs mt-1 break-words">{item.snippet}</div>
                                    </div>)}
                                </div>
                              </div>}

                            {/* Calendar Data Display */}
                            {integration.type === 'calendar' && integration.data.length > 0 && <div className="space-y-2">
                                <p className="text-xs sm:text-sm font-medium text-card-foreground">Recent events:</p>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {integration.data.map((item, index) => <div key={item.id || index} className="p-3 bg-muted rounded-lg border border-border">
                                      <div className="font-medium text-card-foreground text-sm break-words">{item.summary}</div>
                                      <div className="text-muted-foreground text-xs break-words">Start: {new Date(item.start).toLocaleString()}</div>
                                    </div>)}
                                </div>
                              </div>}

                            {/* Slack Data Display */}
                            {integration.type === 'slack' && integration.data && <div className="space-y-3 overflow-hidden">
                                {/* Team Info */}
                                {integration.data.team && <div className="p-3 sm:p-4 bg-muted rounded-lg border border-border">
                                    <p className="text-xs sm:text-sm font-medium text-card-foreground mb-2">Team Info:</p>
                                    <div className="space-y-1">
                                      <div className="font-medium text-card-foreground text-sm break-words">{integration.data.team.name}</div>
                                      <div className="text-muted-foreground text-xs break-words">{integration.data.team.domain}</div>
                                      {integration.data.team.url && <div className="text-primary text-xs break-all">{integration.data.team.url}</div>}
                                    </div>
                                  </div>}

                                {/* Summary */}
                                {integration.data.summary && <div className="p-3 sm:p-4 bg-muted rounded-lg border border-border">
                                    <p className="text-xs sm:text-sm font-medium text-card-foreground mb-3">Data Summary:</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="flex items-center space-x-2">
                                        <Hash size={12} className="text-muted-foreground shrink-0" />
                                        <span className="text-card-foreground text-xs truncate">{integration.data.summary.total_channels} channels</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Users size={12} className="text-muted-foreground shrink-0" />
                                        <span className="text-card-foreground text-xs truncate">{integration.data.summary.total_users} users</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <MessageSquare size={12} className="text-muted-foreground shrink-0" />
                                        <span className="text-card-foreground text-xs truncate">{integration.data.summary.total_messages} messages</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Eye size={12} className="text-muted-foreground shrink-0" />
                                        <span className="text-card-foreground text-xs truncate">{integration.data.summary.accessible_channels} accessible</span>
                                      </div>
                                    </div>
                                  </div>}

                                {/* Recent Messages */}
                                {integration.data.messages && integration.data.messages.length > 0 && <div className="space-y-2">
                                    <p className="text-xs sm:text-sm font-medium text-card-foreground">Recent messages:</p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {integration.data.messages.slice(0, 3).map((message, index) => <div key={message.id || index} className="p-3 bg-muted rounded-lg border border-border">
                                          <div className="font-medium text-card-foreground text-xs break-words">{message.text}</div>
                                          <div className="text-muted-foreground text-xs mt-1 break-words">From: {message.user} in {message.channel}</div>
                                          <div className="text-muted-foreground text-xs break-words">{new Date(message.timestamp).toLocaleString()}</div>
                                        </div>)}
                                    </div>
                                  </div>}

                                {/* Channels */}
                                {integration.data.channels && integration.data.channels.length > 0 && <div className="space-y-2">
                                    <p className="text-xs sm:text-sm font-medium text-card-foreground">All available channels ({integration.data.channels.length}) - click to view details:</p>
                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                      {integration.data.channels.map((channel, index) => <div key={channel.id || index} className="p-3 bg-muted rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors" onClick={() => handleChannelClick(channel)}>
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center space-x-2 min-w-0">
                                              {channel.is_private ? <Lock size={12} className="text-muted-foreground shrink-0" /> : <Globe size={12} className="text-muted-foreground shrink-0" />}
                                              <span className="font-medium text-card-foreground text-xs truncate">#{channel.name}</span>
                                            </div>
                                            <div className="flex items-center space-x-2 shrink-0">
                                              <Badge variant={channel.is_member ? "default" : "secondary"} className="text-xs">
                                                {channel.is_member ? "Member" : "Not Member"}
                                              </Badge>
                                              {channel.num_members && <span className="text-xs text-muted-foreground whitespace-nowrap">{channel.num_members} members</span>}
                                            </div>
                                          </div>
                                          {channel.purpose && <div className="text-muted-foreground text-xs mt-1 break-words line-clamp-2">{channel.purpose}</div>}
                                          {channel.topic && <div className="text-muted-foreground text-xs mt-1 break-words line-clamp-1">Topic: {channel.topic}</div>}
                                        </div>)}
                                    </div>
                                  </div>}
                              </div>}
                          </div>
                        </div> : <div className="space-y-2">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Connect this integration to start syncing data
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Go to Settings → Integrations to connect
                          </p>
                        </div>}
                    </AccordionContent>
                  </AccordionItem>;
            })}
            </Accordion>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-zinc-50 text-base sm:text-lg">
                  <Upload size={18} />
                  <span>Upload Custom Documents</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Add PDFs, images, text files, spreadsheets, or other documents for the AI to reference
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 sm:p-6 text-center">
                    <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-4" />
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm font-medium text-zinc-50">Upload a document</p>
                      <p className="text-xs text-gray-400">
                        Supports .txt, .md, .csv, .pdf, .json, images, and more
                      </p>
                    </div>
                    <Button className="mt-4 w-full sm:w-auto text-xs sm:text-sm" onClick={() => document.getElementById('file-upload')?.click()} disabled={isUploading}>
                      {isUploading ? 'Uploading...' : 'Choose File'}
                    </Button>
                    <input id="file-upload" type="file" accept=".txt,.md,.csv,.pdf,.json,.doc,.docx,image/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {documents.length > 0 && <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-zinc-50">Uploaded Documents</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {documents.length} document{documents.length > 1 ? 's' : ''} available for AI reference
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {documents.map((doc, index) => {
                  const FileIcon = getFileIcon(doc.file_type);
                  return <div key={doc.id}>
                          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg gap-3">
                            <div className="flex items-center space-x-3 min-w-0">
                              <FileIcon size={14} className="text-blue-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium break-words text-zinc-50">{doc.name}</p>
                                <p className="text-xs text-gray-400">
                                  Uploaded {new Date(doc.created_at).toLocaleDateString()} • {doc.file_type}
                                </p>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeCustomDoc(doc.id)} className="text-red-400 hover:text-red-300 shrink-0">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          {index < documents.length - 1 && <Separator className="bg-gray-700" />}
                        </div>;
                })}
                  </div>
                </CardContent>
              </Card>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Channel Details Dialog */}
      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-xs sm:max-w-2xl max-h-[80vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
              {selectedChannel?.is_private ? <Lock size={16} className="text-muted-foreground" /> : <Globe size={16} className="text-muted-foreground" />}
              <span className="break-words">#{selectedChannel?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
              Complete channel information from Slack API
            </DialogDescription>
          </DialogHeader>
          
          {selectedChannel && <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-card-foreground mb-2 text-sm">Basic Info</h4>
                  <div className="space-y-2 text-xs">
                    <div><span className="text-muted-foreground">ID:</span> <span className="text-card-foreground break-all">{selectedChannel.id}</span></div>
                    <div><span className="text-muted-foreground">Name:</span> <span className="text-card-foreground break-words">#{selectedChannel.name}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> <span className="text-card-foreground">{selectedChannel.is_private ? 'Private' : 'Public'} Channel</span></div>
                    <div><span className="text-muted-foreground">Members:</span> <span className="text-card-foreground">{selectedChannel.num_members || 'Unknown'}</span></div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-card-foreground mb-2 text-sm">Membership</h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Member Status:</span> 
                      <Badge className={`ml-2 text-xs ${selectedChannel.is_member ? 'bg-primary' : 'bg-destructive'}`}>
                        {selectedChannel.is_member ? 'Member' : 'Not Member'}
                      </Badge>
                    </div>
                    <div><span className="text-muted-foreground">Is Channel:</span> <span className="text-card-foreground">{selectedChannel.is_channel ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>
              </div>

              {selectedChannel.purpose && <div>
                  <h4 className="font-medium text-card-foreground mb-2 text-sm">Purpose</h4>
                  <p className="text-card-foreground text-xs bg-muted p-3 rounded border border-border break-words">
                    {selectedChannel.purpose}
                  </p>
                </div>}

              {selectedChannel.topic && <div>
                  <h4 className="font-medium text-card-foreground mb-2 text-sm">Topic</h4>
                  <p className="text-card-foreground text-xs bg-muted p-3 rounded border border-border break-words">
                    {selectedChannel.topic}
                  </p>
                </div>}

              <div>
                <h4 className="font-medium text-card-foreground mb-2 text-sm">Raw Channel Data</h4>
                <pre className="text-xs text-muted-foreground bg-muted p-3 rounded border border-border overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedChannel, null, 2)}
                </pre>
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default DataPage;