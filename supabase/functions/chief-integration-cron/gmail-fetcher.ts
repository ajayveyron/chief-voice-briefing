
import { UserIntegration, EmailData } from './types.ts';

export async function fetchGmailData(integration: UserIntegration, validToken: string): Promise<EmailData[]> {
  try {
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=-category:{promotions updates forums social}&labelIds=INBOX', {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!gmailResponse.ok) {
      throw new Error(`Gmail API error: ${gmailResponse.status}`);
    }

    const messagesData = await gmailResponse.json();
    const emails: EmailData[] = [];

    for (const message of messagesData.messages || []) {
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (detailResponse.ok) {
        const emailDetail = await detailResponse.json();
        
        const headers = emailDetail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';
        
        let body = '';
        if (emailDetail.payload?.body?.data) {
          body = atob(emailDetail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (emailDetail.payload?.parts) {
          const textPart = emailDetail.payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }

        emails.push({
          id: message.id,
          subject,
          from,
          date,
          snippet: emailDetail.snippet || '',
          body: body.substring(0, 500)
        });
      }
    }

    return emails;
  } catch (error) {
    console.error(`Error fetching Gmail data:`, error);
    return [];
  }
}
