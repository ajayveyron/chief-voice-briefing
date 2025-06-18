import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GmailTest } from "@/components/GmailTest";
import { CalendarTest } from "@/components/CalendarTest";
import { SlackTest } from "@/components/SlackTest";
import { NotionTest } from "@/components/NotionTest";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const DataPage = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] p-4">
      <Card className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center p-0">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <Avatar className="w-20 h-20 mb-2 border-4 border-white/30 bg-gray-900">
            <AvatarFallback className="text-4xl">📊</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Data & Integrations
          </h1>
          <p className="text-base text-gray-200 font-medium">
            Test your integrations and view collected data
          </p>
        </div>
        <Separator className="bg-gray-700 my-2" />
        <div className="w-full px-4 pb-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-8">
            {/* Integration Tests */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Integration Tests
              </h2>
              <div className="grid gap-4">
                <GmailTest />
                <CalendarTest />
                <SlackTest />
                <NotionTest />
              </div>
            </div>
            {/* Data Overview */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Data Overview
              </h2>
              <Card className="bg-gray-800/80 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    Collected Data Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400">
                    View and manage data collected from your integrations. This
                    includes emails, calendar events, messages, and documents.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DataPage;
