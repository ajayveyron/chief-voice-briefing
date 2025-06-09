
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthForm from "@/components/AuthForm";
import BottomNav from "@/components/BottomNav";
import HomePage from "@/components/HomePage";
import ChatPage from "@/components/ChatPage";
import DataPage from "@/components/DataPage";
import SettingsPage from "@/components/SettingsPage";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home":
        return <HomePage />;
      case "chat":
        return <ChatPage />;
      case "data":
        return <DataPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-md mx-auto">
      {/* Main content area */}
      <div className="flex-1 pb-16">
        {renderActiveTab()}
      </div>
      
      {/* Bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
