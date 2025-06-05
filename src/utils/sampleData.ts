
import { supabase } from "@/integrations/supabase/client";

export const addSampleUpdates = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("No user found");
    return;
  }

  const sampleUpdates = [
    {
      user_id: user.id,
      integration_type: "gmail",
      update_type: "email",
      title: "Important project update from Sarah",
      summary: "Sarah sent an update about the Q1 project timeline. The deadline has been moved to next Friday, and she needs your feedback on the mockups by Wednesday.",
      priority: 4,
      raw_data: { from: "sarah@company.com", subject: "Q1 Project Timeline Update" }
    },
    {
      user_id: user.id,
      integration_type: "slack",
      update_type: "message",
      title: "Team standup discussion",
      summary: "The engineering team discussed the new feature rollout. Mike mentioned some concerns about the database performance, and Lisa suggested we run load tests this week.",
      priority: 3,
      raw_data: { channel: "#engineering", mentions: 5 }
    },
    {
      user_id: user.id,
      integration_type: "calendar",
      update_type: "meeting",
      title: "Client meeting scheduled",
      summary: "You have a client presentation scheduled for tomorrow at 2 PM. The agenda includes product demo and Q2 roadmap discussion. Make sure to prepare the latest metrics.",
      priority: 5,
      raw_data: { start_time: "2024-01-16T14:00:00Z", duration: 60 }
    },
    {
      user_id: user.id,
      integration_type: "gmail",
      update_type: "email",
      title: "Budget approval needed",
      summary: "Finance team needs your approval for the marketing budget proposal. The request is for $15K for the next campaign, due by end of week.",
      priority: 3,
      raw_data: { from: "finance@company.com", subject: "Budget Approval Request" }
    }
  ];

  try {
    const { error } = await supabase
      .from("updates")
      .insert(sampleUpdates);

    if (error) {
      console.error("Error adding sample data:", error);
    } else {
      console.log("Sample data added successfully!");
    }
  } catch (error) {
    console.error("Error adding sample data:", error);
  }
};
