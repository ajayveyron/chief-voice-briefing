
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GmailTest from './GmailTest';
import CalendarTest from './CalendarTest';
import SlackTest from './SlackTest';
import NotionTest from './NotionTest';
import { Mail, Calendar, MessageCircle, FileText } from 'lucide-react';

const DataTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integration Data</h1>
        <p className="text-muted-foreground">
          Test and manage your data integrations
        </p>
      </div>

      <Tabs defaultValue="gmail" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Gmail
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="slack" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Slack
          </TabsTrigger>
          <TabsTrigger value="notion" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gmail" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Gmail Integration
              </CardTitle>
              <CardDescription>
                Test Gmail API connection and fetch recent emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GmailTest />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar Integration
              </CardTitle>
              <CardDescription>
                Test Google Calendar API connection and fetch events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarTest />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slack" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Slack Integration
              </CardTitle>
              <CardDescription>
                Test Slack API connection and fetch messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlackTest />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notion Integration
              </CardTitle>
              <CardDescription>
                Test Notion API connection and fetch pages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotionTest />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataTab;
