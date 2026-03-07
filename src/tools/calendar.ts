import { google } from 'googleapis';
import { config } from '../config/index.js';

function getCalendarClient() {
  if (!config.google.clientId || !config.google.refreshToken) {
    throw new Error('Google credentials not configured');
  }

  const auth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  auth.setCredentials({ refresh_token: config.google.refreshToken });
  return google.calendar({ version: 'v3', auth });
}

export async function readCalendar(args: { days?: number; maxResults?: number }): Promise<string> {
  const calendar = getCalendarClient();
  const days = args.days ?? 7;
  const maxResults = args.maxResults ?? 10;

  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items;
  if (!events || events.length === 0) {
    return `No events in the next ${days} days.`;
  }

  return events
    .map((e) => {
      const start = e.start?.dateTime || e.start?.date || 'Unknown';
      const end = e.end?.dateTime || e.end?.date || '';
      const attendees = e.attendees?.map((a) => a.email).join(', ') || 'None';
      return [
        `Title: ${e.summary || '(No title)'}`,
        `Start: ${start}`,
        `End: ${end}`,
        `Location: ${e.location || 'N/A'}`,
        `Attendees: ${attendees}`,
        `Description: ${e.description || 'N/A'}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

export async function createCalendarEvent(args: {
  title: string;
  startDateTime: string;
  endDateTime: string;
  description?: string;
  location?: string;
  attendees?: string;
}): Promise<string> {
  const calendar = getCalendarClient();

  const attendeeList = args.attendees
    ? args.attendees.split(',').map((email) => ({ email: email.trim() }))
    : [];

  const event = {
    summary: args.title,
    location: args.location,
    description: args.description,
    start: { dateTime: args.startDateTime, timeZone: 'UTC' },
    end: { dateTime: args.endDateTime, timeZone: 'UTC' },
    attendees: attendeeList,
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: attendeeList.length > 0 ? 'all' : 'none',
  });

  return `Event created: "${args.title}" on ${args.startDateTime}. Link: ${res.data.htmlLink}`;
}
