import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { useActionExecution } from "@/hooks/useActionExecution";

export const ActionConfirmationDialog = () => {
  const { pendingActions, confirmAction, executingActions } = useActionExecution();

  if (pendingActions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {pendingActions.map((action) => (
        <Card key={action.id} className="border-warning bg-background/95 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Action Confirmation Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {action.confirmation_prompt}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{action.type}</Badge>
                {action.action_details?.payload?.to && (
                  <Badge variant="secondary" className="text-xs">
                    To: {action.action_details.payload.to}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => confirmAction(action.id, true)}
                disabled={executingActions.has(action.id)}
                className="flex-1"
              >
                {executingActions.has(action.id) ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-3 w-3" />
                    Confirm
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => confirmAction(action.id, false)}
                disabled={executingActions.has(action.id)}
                className="flex-1"
              >
                <XCircle className="mr-2 h-3 w-3" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};