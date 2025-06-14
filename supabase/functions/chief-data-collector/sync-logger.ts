// Sync logging functionality for tracking integration sync sessions

// Function to log sync status
export async function logSyncStatus(
  supabase: any, 
  integrationId: string, 
  syncType: 'polling' | 'webhook', 
  status: 'success' | 'error' | 'partial',
  errorMessage?: string,
  metadata?: any
) {
  const { error } = await supabase
    .from('integration_sync_log')
    .insert({
      integration_id: integrationId,
      sync_type: syncType,
      status,
      last_synced_at: new Date().toISOString(),
      error_message: errorMessage,
      metadata: metadata || {}
    });

  if (error) {
    console.error('Error logging sync status:', error);
  }
}