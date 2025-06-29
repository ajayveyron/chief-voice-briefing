
export interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
}

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description: string;
  location: string;
  attendees: string[];
  htmlLink: string;
}

export interface SlackMessage {
  id: string;
  text: string;
  user: string;
  channel: string;
  timestamp: string;
}
