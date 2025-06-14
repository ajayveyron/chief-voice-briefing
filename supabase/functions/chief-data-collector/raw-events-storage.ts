// Raw events storage with deduplication
import { createContentHash } from './utils.ts';

// Function to store raw events with deduplication
export async function storeRawEvent(
  supabase: any,
  integrationId: string,
  userId: string,
  source: string,
  eventType: string,
  content: any,
  sourceId: string
) {
  const contentHash = createContentHash(content, sourceId);
  
  // Check if we already have this content
  const { data: existing } = await supabase
    .from('raw_events')
    .select('id')
    .eq('content_hash', contentHash)
    .single();

  if (existing) {
    console.log(`Skipping duplicate content: ${contentHash}`);
    return null;
  }

  // Store new raw event
  const { data, error } = await supabase
    .from('raw_events')
    .insert({
      integration_id: integrationId,
      user_id: userId,
      source,
      event_type: eventType,
      content: JSON.stringify(content),
      content_hash: contentHash,
      timestamp: new Date().toISOString(),
      status: 'raw'
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing raw event:', error);
    return null;
  }

  return data;
}