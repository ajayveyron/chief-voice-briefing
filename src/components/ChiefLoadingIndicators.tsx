import React from "react";

interface ChiefLoadingIndicatorsProps {
  isLoadingUserData: boolean;
  isLoadingTools: boolean;
  userPreferences: any;
  userContacts: any[];
  availableTools: any[];
  className?: string;
}

export const ChiefLoadingIndicators: React.FC<ChiefLoadingIndicatorsProps> = ({
  isLoadingUserData,
  isLoadingTools,
  userPreferences,
  userContacts,
  availableTools,
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      {isLoadingUserData && (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <span className="text-sm">
            Loading your preferences and contacts...
          </span>
        </div>
      )}
      {isLoadingTools && (
        <div className="flex items-center gap-2 text-purple-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
          <span className="text-sm">Loading MCP tools...</span>
        </div>
      )}
      {userPreferences && !isLoadingUserData && (
        <p className="text-green-400 text-sm">
          ✓ Your communication preferences loaded
        </p>
      )}
      {userContacts.length > 0 && !isLoadingUserData && (
        <p className="text-green-400 text-sm">
          ✓ {userContacts.length} contacts loaded
        </p>
      )}
      {availableTools.length > 0 && !isLoadingTools && (
        <p className="text-green-400 text-sm">
          ✓ {availableTools.length} MCP tools available
        </p>
      )}
    </div>
  );
};
