import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to generate action suggestions based on summary
async function generateActionSuggestions(
  summary: string, 
  topic: string, 
  source: string, 
  originalContent: any,
  userContext: any = {}
): Promise<Array<{
  type: string;
  prompt: string;
  confidence_score: number;
  requires_confirmation: boolean;
  payload: any;
}>> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.warn('OpenAI API key not configured - returning basic suggestions');
    return [{
      type: 'review',
      prompt: `Review this ${source} update: ${summary}`,
      confidence_score: 0.5,
      requires_confirmation: true,
      payload: { action: 'review', source, summary }
    }];
  }

  try {
    const prompt = `
You are Chief, an AI executive assistant. Based on this summary, suggest specific actionable items.

Summary: ${summary}
Topic: ${topic}
Source: ${source}
Original Content: ${JSON.stringify(originalContent)}
User Context: ${JSON.stringify(userContext)}

Generate up to 3 specific, actionable suggestions that I could execute for the user.

Common action types:
- schedule_meeting: Schedule a meeting with someone
- send_email: Send a reply or follow-up email
- create_reminder: Set a reminder for something
- calendar_check: Check calendar availability
- send_slack: Send a Slack message
- review_document: Review a shared document
- follow_up: Follow up on a request or task

Respond with ONLY valid JSON array in this exact format:
[
  {
    "type": "action_type",
    "prompt": "Natural language suggestion for the user",
    "confidence_score": 0.85,
    "requires_confirmation": true,
    "payload": {
      "action_details": "specific parameters for execution"
    }
  }
]

Guidelines:
- Only suggest actions that are clearly actionable and relevant
- Set confidence_score between 0.1 and 1.0 based on how certain you are
- Use requires_confirmation: true for any action that sends messages or makes commitments
- Include specific details in payload for execution
- If no clear actions, return empty array []`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestions = JSON.parse(data.choices[0].message.content);
    
    // Validate and sanitize suggestions
    return Array.isArray(suggestions) ? suggestions.filter(s => 
      s.type && s.prompt && typeof s.confidence_score === 'number'
    ) : [];
    
  } catch (error) {
    console.error('Error generating action suggestions:', error);
    return [{
      type: 'review',
      prompt: `Review this ${source} update: ${summary}`,
      confidence_score: 0.5,
      requires_confirmation: true,
      payload: { action: 'review', source, summary, error: error.message }
    }];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { summary_id, summary, topic, source, original_content, user_id, user_context } = await req.json();

    if (!summary_id || !summary || !source || !user_id) {
      throw new Error('Missing required parameters: summary_id, summary, source, user_id');
    }

    console.log(`🎯 Generating action suggestions for summary ${summary_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate action suggestions
    const suggestions = await generateActionSuggestions(
      summary, 
      topic || '', 
      source, 
      original_content,
      user_context
    );

    console.log(`📋 Generated ${suggestions.length} action suggestions`);

    // Store suggestions in database
    const createdSuggestions = [];
    for (const suggestion of suggestions) {
      const { data: suggestionData, error: suggestionError } = await supabase
        .from('llm_suggestions')
        .insert({
          summary_id,
          user_id,
          type: suggestion.type,
          prompt: suggestion.prompt,
          confidence_score: suggestion.confidence_score,
          requires_confirmation: suggestion.requires_confirmation,
          payload: suggestion.payload
        })
        .select()
        .single();

      if (suggestionError) {
        console.error('Error creating suggestion:', suggestionError);
      } else {
        createdSuggestions.push(suggestionData);
      }
    }

    // Log audit trail
    await supabase
      .from('event_audit_log')
      .insert({
        raw_event_id: null, // This stage doesn't have direct raw_event_id
        user_id,
        stage: 'action_suggested',
        status: 'success',
        message: `Generated ${createdSuggestions.length} action suggestions for summary ${summary_id}`
      });

    console.log(`✅ Created ${createdSuggestions.length} action suggestions`);

    return new Response(
      JSON.stringify({
        success: true,
        summary_id,
        suggestions_created: createdSuggestions.length,
        suggestions: createdSuggestions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('❌ Error in Chief Action Suggester:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});