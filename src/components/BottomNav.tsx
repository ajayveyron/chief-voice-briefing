import { Home, MessageSquare, Settings, Database } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const location = useLocation();
  
  const tabs = [
    { id: "home", label: "Home", icon: Home, path: "/home" },
    { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" },
    { id: "data", label: "Data", icon: Database, path: "/data" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 max-w-md mx-auto right-0 bg-gray-900 border-t border-gray-700">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive ? "text-white" : "text-gray-400"
              )}
            >
              <Icon size={20} />
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;