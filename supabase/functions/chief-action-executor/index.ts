import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeAction } from './action-handlers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteActionRequest {
  action_id?: string;
  suggestion_id?: string;
  action_type: string;
  payload: any;
  user_id: string;
  requires_confirmation?: boolean;
  confirmed?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      action_id, 
      suggestion_id, 
      action_type, 
      payload, 
      user_id, 
      requires_confirmation = true,
      confirmed = false 
    }: ExecuteActionRequest = await req.json();

    if (!action_type || !payload || !user_id) {
      throw new Error('Missing required parameters: action_type, payload, user_id');
    }

    console.log(`🎯 Chief Action Executor: ${action_type} for user ${user_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let actionRecord;

    // If action_id provided, update existing action
    if (action_id) {
      const { data: existingAction, error: fetchError } = await supabase
        .from('actions')
        .select('*')
        .eq('id', action_id)
        .eq('user_id', user_id)
        .single();

      if (fetchError || !existingAction) {
        throw new Error('Action not found or unauthorized');
      }

      actionRecord = existingAction;
    } else {
      // Create new action record
      const { data: newAction, error: createError } = await supabase
        .from('actions')
        .insert({
          suggestion_id,
          user_id,
          type: action_type,
          payload,
          status: requires_confirmation && !confirmed ? 'pending' : 'confirmed'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create action record: ${createError.message}`);
      }

      actionRecord = newAction;
    }

    // Check if confirmation is required and not yet confirmed
    if (requires_confirmation && !confirmed && actionRecord.status === 'pending') {
      return new Response(
        JSON.stringify({
          success: true,
          action_id: actionRecord.id,
          status: 'pending_confirmation',
          message: 'Action created and awaiting user confirmation',
          confirmation_prompt: `Do you want me to execute this action: ${action_type}?`,
          action_details: {
            type: action_type,
            payload: payload
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Execute the action
    console.log(`⚡ Executing action ${actionRecord.id}: ${action_type}`);
    
    try {
      // Update status to executing
      await supabase
        .from('actions')
        .update({ status: 'executing' })
        .eq('id', actionRecord.id);

      // Execute the action
      const result = await executeAction(action_type, payload, supabase);

      if (result.success) {
        // Update action as executed
        await supabase
          .from('actions')
          .update({ 
            status: 'executed',
            executed_at: new Date().toISOString(),
            executed_by_user: false
          })
          .eq('id', actionRecord.id);

        // Log success in audit trail
        await supabase
          .from('event_audit_log')
          .insert({
            raw_event_id: null,
            user_id,
            stage: 'action_executed',
            status: 'success',
            message: `Action ${action_type} executed successfully: ${result.message}`
          });

        console.log(`✅ Action ${actionRecord.id} executed successfully`);

        return new Response(
          JSON.stringify({
            success: true,
            action_id: actionRecord.id,
            status: 'executed',
            message: result.message,
            data: result.data
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      } else {
        // Update action as failed
        await supabase
          .from('actions')
          .update({ 
            status: 'failed',
            executed_at: new Date().toISOString()
          })
          .eq('id', actionRecord.id);

        // Log failure in audit trail
        await supabase
          .from('event_audit_log')
          .insert({
            raw_event_id: null,
            user_id,
            stage: 'action_executed',
            status: 'failed',
            message: `Action ${action_type} failed: ${result.error}`
          });

        console.log(`❌ Action ${actionRecord.id} failed: ${result.error}`);

        return new Response(
          JSON.stringify({
            success: false,
            action_id: actionRecord.id,
            status: 'failed',
            message: result.message,
            error: result.error,
            retry_available: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    } catch (executionError) {
      // Update action as failed
      await supabase
        .from('actions')
        .update({ 
          status: 'failed',
          executed_at: new Date().toISOString()
        })
        .eq('id', actionRecord.id);

      // Log execution error
      await supabase
        .from('event_audit_log')
        .insert({
          raw_event_id: null,
          user_id,
          stage: 'action_executed',
          status: 'failed',
          message: `Action execution error: ${executionError.message}`
        });

      throw executionError;
    }

  } catch (error) {
    console.error('❌ Error in Chief Action Executor:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        retry_available: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});