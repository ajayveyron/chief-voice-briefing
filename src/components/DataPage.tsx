
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GmailTest } from "@/components/GmailTest";
import { CalendarTest } from "@/components/CalendarTest";
import { SlackTest } from "@/components/SlackTest";
import { NotionTest } from "@/components/NotionTest";

const DataPage = () => {
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-semibold">Data & Integrations</h1>
        <p className="text-sm text-gray-400 mt-1">Test your connected integrations and view collected data</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Integration Tests */}
        <div>
          <h2 className="text-lg font-medium mb-4">Integration Tests</h2>
          <div className="grid gap-4">
            <GmailTest />
            <CalendarTest />
            <SlackTest />
            <NotionTest />
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Data Overview */}
        <div>
          <h2 className="text-lg font-medium mb-4">Data Overview</h2>
          <Card>
            <CardHeader>
              <CardTitle>Collected Data Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">
                View and manage data collected from your integrations. This includes emails, calendar events, messages, and documents.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DataPage;
