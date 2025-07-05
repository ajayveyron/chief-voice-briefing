import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { ActionConfirmationDialog } from "@/components/ActionConfirmationDialog";
import PrivacyNotification from "@/components/PrivacyNotification";

const AppLayout = () => {
  return (
    <div className="h-full flex-1 bg-black text-white flex flex-col max-w-md mx-auto min-h-screen">
      {/* Privacy Notification Banner */}
      <PrivacyNotification variant="banner" />

      {/* Main content area */}
      <div className="flex-1 flex-col h-full pb-16">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <BottomNav />

      {/* Action confirmation dialog */}
      <ActionConfirmationDialog />
    </div>
  );
};

export default AppLayout;