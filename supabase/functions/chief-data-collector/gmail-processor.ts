// Gmail data processing
import { logSyncStatus } from './sync-logger.ts';
import { storeRawEvent } from './raw-events-storage.ts';

// Function to fetch and process Gmail emails
export async function processGmailData(supabase: any): Promise<number> {
  console.log('🔄 Processing Gmail data...');
  let totalProcessed = 0;

  try {
    // Get all active Gmail integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('integration_type', 'gmail')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching Gmail integrations:', intError);
      return 0;
    }

    console.log(`📧 Found ${integrations?.length || 0} Gmail integrations`);

    for (const integration of integrations || []) {
      try {
        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, { 
          started_at: new Date().toISOString() 
        });

        // Call the existing fetch-gmail-emails function
        const { data: emailData, error: emailError } = await supabase.functions.invoke('fetch-gmail-emails', {
          headers: {
            Authorization: `Bearer ${integration.access_token}`
          }
        });

        if (emailError) {
          console.error(`Error fetching emails for user ${integration.user_id}:`, emailError);
          await logSyncStatus(supabase, integration.id, 'polling', 'error', emailError.message);
          continue;
        }

        const emails = emailData?.emails || [];
        console.log(`📧 Processing ${emails.length} emails for user ${integration.user_id}`);

        for (const email of emails) {
          const rawEvent = await storeRawEvent(
            supabase,
            integration.id,
            integration.user_id,
            'gmail',
            'email',
            email,
            email.id
          );
          
          if (rawEvent) {
            totalProcessed++;
          }
        }

        await logSyncStatus(supabase, integration.id, 'polling', 'success', null, {
          emails_processed: emails.length,
          completed_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing Gmail for user ${integration.user_id}:`, error);
        await logSyncStatus(supabase, integration.id, 'polling', 'error', error.message);
      }
    }
  } catch (error) {
    console.error('Error in Gmail processing:', error);
  }

  return totalProcessed;
}