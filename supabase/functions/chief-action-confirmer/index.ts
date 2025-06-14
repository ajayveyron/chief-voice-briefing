import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionConfirmationRequest {
  action_id: string;
  user_id: string;
  confirmed: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action_id, user_id, confirmed }: ActionConfirmationRequest = await req.json();

    if (!action_id || !user_id || confirmed === undefined) {
      throw new Error('Missing required parameters: action_id, user_id, confirmed');
    }

    console.log(`🤔 Action confirmation: ${action_id}, confirmed: ${confirmed}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the action record
    const { data: action, error: fetchError } = await supabase
      .from('actions')
      .select('*')
      .eq('id', action_id)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !action) {
      throw new Error('Action not found or unauthorized');
    }

    if (action.status !== 'pending') {
      throw new Error(`Action is not pending confirmation. Current status: ${action.status}`);
    }

    if (confirmed) {
      // User confirmed - trigger execution
      console.log(`✅ User confirmed action ${action_id}, triggering execution`);

      const { data: executionResult, error: executionError } = await supabase.functions.invoke('chief-action-executor', {
        body: {
          action_id: action_id,
          action_type: action.type,
          payload: action.payload,
          user_id: user_id,
          requires_confirmation: false,
          confirmed: true
        }
      });

      if (executionError) {
        console.error('Error executing confirmed action:', executionError);
        
        // Update action status to failed
        await supabase
          .from('actions')
          .update({ status: 'failed' })
          .eq('id', action_id);

        return new Response(
          JSON.stringify({
            success: false,
            action_id,
            status: 'failed',
            message: 'Failed to execute confirmed action',
            error: executionError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          action_id,
          status: 'executed',
          message: 'Action confirmed and executed successfully',
          execution_result: executionResult
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } else {
      // User rejected - mark as cancelled
      console.log(`❌ User rejected action ${action_id}`);

      await supabase
        .from('actions')
        .update({ 
          status: 'cancelled',
          executed_at: new Date().toISOString()
        })
        .eq('id', action_id);

      // Log cancellation
      await supabase
        .from('event_audit_log')
        .insert({
          raw_event_id: null,
          user_id,
          stage: 'action_cancelled',
          status: 'success',
          message: `Action ${action.type} cancelled by user`
        });

      return new Response(
        JSON.stringify({
          success: true,
          action_id,
          status: 'cancelled',
          message: 'Action cancelled by user'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

  } catch (error) {
    console.error('❌ Error in Chief Action Confirmer:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});