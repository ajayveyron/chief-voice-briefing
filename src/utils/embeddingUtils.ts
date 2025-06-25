
import { pipeline } from '@huggingface/transformers';
import { supabase } from '@/integrations/supabase/client';

export interface EmbeddingData {
  title: string;
  body: string;
}

export const generateAndStoreEmbedding = async (data: EmbeddingData) => {
  console.log('🔄 Initializing embedding pipeline...');
  
  // Generate embedding using Hugging Face transformers
  const generateEmbedding = await pipeline('feature-extraction', 'Supabase/gte-small');
  
  console.log('🔄 Generating embedding for text...');
  
  // Generate a vector using Transformers.js
  const output = await generateEmbedding(data.body, {
    pooling: 'mean',
    normalize: true,
  });

  // Extract the embedding output and convert to string
  const embeddingArray = Array.from(output.data);
  const embeddingString = JSON.stringify(embeddingArray);
  
  console.log('✅ Embedding generated:', embeddingArray.length, 'dimensions');

  // Store the vector in Postgres
  const { data: insertData, error: insertError } = await supabase.from('posts').insert({
    title: data.title,
    body: data.body,
    embedding: embeddingString,
  });

  if (insertError) {
    throw insertError;
  }

  console.log('✅ Embedding stored successfully');
  return {
    title: data.title,
    body: data.body,
    embeddingDimensions: embeddingArray.length,
    data: insertData
  };
};

export const embedData = async (items: any[], source: string) => {
  console.log(`🔄 Starting embedding process for ${items.length} ${source} items...`);
  
  try {
    let formattedData: EmbeddingData[] = [];
    
    switch (source) {
      case 'gmail':
        formattedData = formatGmailForEmbedding(items);
        break;
      case 'calendar':
        formattedData = formatCalendarForEmbedding(items);
        break;
      case 'slack':
        formattedData = formatSlackForEmbedding(items);
        break;
      case 'notion':
        formattedData = formatNotionForEmbedding(items);
        break;
      default:
        throw new Error(`Unsupported source: ${source}`);
    }

    const results = [];
    for (const item of formattedData) {
      const result = await generateAndStoreEmbedding(item);
      results.push(result);
    }

    console.log(`✅ Successfully embedded ${results.length} items from ${source}`);
    return results;
  } catch (error) {
    console.error(`❌ Error embedding ${source} data:`, error);
    throw error;
  }
};

export const formatGmailForEmbedding = (emails: any[]): EmbeddingData[] => {
  return emails.map(email => ({
    title: `Gmail: ${email.subject || 'No Subject'}`,
    body: `From: ${email.from}\nSubject: ${email.subject || 'No Subject'}\n\n${email.snippet || email.body || ''}`
  }));
};

export const formatCalendarForEmbedding = (events: any[]): EmbeddingData[] => {
  return events.map(event => ({
    title: `Calendar: ${event.summary || 'Untitled Event'}`,
    body: `Event: ${event.summary || 'Untitled Event'}\nLocation: ${event.location || 'No location'}\nDescription: ${event.description || 'No description'}`
  }));
};

export const formatSlackForEmbedding = (messages: any[]): EmbeddingData[] => {
  return messages.map(message => ({
    title: `Slack: ${message.channel_name ? `#${message.channel_name}` : 'Direct Message'}`,
    body: `Channel: ${message.channel_name || 'Direct Message'}\nUser: ${message.username || 'Unknown'}\nMessage: ${message.text || ''}`
  }));
};

export const formatNotionForEmbedding = (pages: any[]): EmbeddingData[] => {
  return pages.map(page => ({
    title: `Notion: ${page.title || 'Untitled Page'}`,
    body: `Page: ${page.title || 'Untitled Page'}\nCreated: ${page.created_time}\nArchived: ${page.archived ? 'Yes' : 'No'}`
  }));
};
