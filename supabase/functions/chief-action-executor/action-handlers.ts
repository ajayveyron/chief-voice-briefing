// Action type handlers for the Chief Action Executor
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ActionPayload {
  [key: string]: any;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Email action handler
export async function executeEmailAction(payload: ActionPayload, supabase: any): Promise<ActionResult> {
  console.log('📧 Executing email action:', payload);
  
  try {
    const { to, subject, body, cc, bcc } = payload;
    
    if (!to || !subject || !body) {
      throw new Error('Missing required email fields: to, subject, body');
    }

    // Call the existing send-email function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: Array.isArray(to) ? to : [to],
        subject,
        html: body,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined
      }
    });

    if (error) {
      throw new Error(`Email sending failed: ${error.message}`);
    }

    return {
      success: true,
      message: `Email sent to ${Array.isArray(to) ? to.join(', ') : to}`,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send email',
      error: error.message
    };
  }
}

// Calendar action handler
export async function executeCalendarAction(payload: ActionPayload, supabase: any): Promise<ActionResult> {
  console.log('📅 Executing calendar action:', payload);
  
  try {
    const { action_type, title, start_time, end_time, attendees, description } = payload;
    
    if (action_type === 'create_event') {
      if (!title || !start_time) {
        throw new Error('Missing required fields for calendar event: title, start_time');
      }

      // Call the existing manage-calendar function
      const { data, error } = await supabase.functions.invoke('manage-calendar', {
        body: {
          action: 'create',
          event: {
            summary: title,
            start: { dateTime: start_time },
            end: { dateTime: end_time || new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString() },
            attendees: attendees ? attendees.map(email => ({ email })) : undefined,
            description: description || ''
          }
        }
      });

      if (error) {
        throw new Error(`Calendar event creation failed: ${error.message}`);
      }

      return {
        success: true,
        message: `Calendar event "${title}" created`,
        data: data
      };
    } else {
      throw new Error(`Unsupported calendar action: ${action_type}`);
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to execute calendar action',
      error: error.message
    };
  }
}

// Slack action handler
export async function executeSlackAction(payload: ActionPayload, supabase: any): Promise<ActionResult> {
  console.log('💬 Executing Slack action:', payload);
  
  try {
    const { channel, message, user } = payload;
    
    if (!message) {
      throw new Error('Missing required field: message');
    }

    // Call the existing send-slack-message function
    const { data, error } = await supabase.functions.invoke('send-slack-message', {
      body: {
        channel: channel || 'general',
        text: message,
        user: user
      }
    });

    if (error) {
      throw new Error(`Slack message sending failed: ${error.message}`);
    }

    return {
      success: true,
      message: `Slack message sent to ${channel || 'general'}`,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send Slack message',
      error: error.message
    };
  }
}

// Reminder action handler
export async function executeReminderAction(payload: ActionPayload, supabase: any): Promise<ActionResult> {
  console.log('⏰ Executing reminder action:', payload);
  
  try {
    const { title, description, remind_at, user_id } = payload;
    
    if (!title || !remind_at || !user_id) {
      throw new Error('Missing required fields: title, remind_at, user_id');
    }

    // Create a scheduled task for the reminder
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .insert({
        user_id,
        task_type: 'reminder',
        title,
        description: description || '',
        scheduled_for: remind_at,
        metadata: { created_by: 'chief_assistant' }
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Reminder creation failed: ${error.message}`);
    }

    return {
      success: true,
      message: `Reminder "${title}" scheduled for ${new Date(remind_at).toLocaleString()}`,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to create reminder',
      error: error.message
    };
  }
}

// Main action executor function
export async function executeAction(actionType: string, payload: ActionPayload, supabase: any): Promise<ActionResult> {
  console.log(`🎯 Executing action type: ${actionType}`);
  
  switch (actionType) {
    case 'send_email':
      return await executeEmailAction(payload, supabase);
    
    case 'schedule_meeting':
    case 'create_event':
      return await executeCalendarAction({ ...payload, action_type: 'create_event' }, supabase);
    
    case 'send_slack':
      return await executeSlackAction(payload, supabase);
    
    case 'create_reminder':
      return await executeReminderAction(payload, supabase);
    
    default:
      return {
        success: false,
        message: `Unknown action type: ${actionType}`,
        error: `Action type "${actionType}" is not supported`
      };
  }
}