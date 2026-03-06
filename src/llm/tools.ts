// Unified tool definitions (JSON Schema format)
// Converted to Anthropic or OpenAI format as needed by the LLM module

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  // ── Email ────────────────────────────────────────────────────────────────
  {
    name: 'read_emails',
    description:
      'Read recent emails from Gmail. Returns subject, sender, date, and body preview.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of emails to fetch (default 10, max 50)' },
        query: {
          type: 'string',
          description:
            'Gmail search query, e.g. "from:boss@company.com", "subject:invoice", "is:unread"',
        },
      },
      required: [],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Plain-text email body' },
        cc: { type: 'string', description: 'CC email address (optional)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // ── Calendar ─────────────────────────────────────────────────────────────
  {
    name: 'read_calendar',
    description: 'Read upcoming Google Calendar events.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'How many days ahead to look (default 7)',
        },
        maxResults: {
          type: 'number',
          description: 'Max events to return (default 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new Google Calendar event.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        startDateTime: {
          type: 'string',
          description: 'Start date/time in ISO 8601 format, e.g. 2025-06-01T10:00:00',
        },
        endDateTime: {
          type: 'string',
          description: 'End date/time in ISO 8601 format',
        },
        description: { type: 'string', description: 'Event description (optional)' },
        location: { type: 'string', description: 'Event location (optional)' },
        attendees: {
          type: 'string',
          description: 'Comma-separated list of attendee emails (optional)',
        },
      },
      required: ['title', 'startDateTime', 'endDateTime'],
    },
  },

  // ── Notes (Notion) ───────────────────────────────────────────────────────
  {
    name: 'read_notes',
    description: 'Read notes from Notion database.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter notes' },
        limit: { type: 'number', description: 'Max number of notes to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in Notion.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content (markdown supported)' },
        tags: {
          type: 'string',
          description: 'Comma-separated list of tags (optional)',
        },
      },
      required: ['title', 'content'],
    },
  },

  // ── GitHub ───────────────────────────────────────────────────────────────
  {
    name: 'github_list_repos',
    description: 'List GitHub repositories for the authenticated user.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max repos to return (default 20)' },
        type: {
          type: 'string',
          description: 'Filter: all, public, private (default: all)',
          enum: ['all', 'public', 'private'],
        },
      },
      required: [],
    },
  },
  {
    name: 'github_create_repo',
    description: 'Create a new GitHub repository.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Repository name' },
        description: { type: 'string', description: 'Repository description (optional)' },
        private: { type: 'string', description: 'true or false (default: false)' },
        autoInit: {
          type: 'string',
          description: 'Initialize with README (true/false, default: true)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'github_write_file',
    description:
      'Create or update a file in a GitHub repository. Use this to deploy code.',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name (uses GITHUB_DEFAULT_REPO if omitted)',
        },
        path: { type: 'string', description: 'File path in the repo, e.g. src/app.py' },
        content: { type: 'string', description: 'File content' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch name (default: main)' },
      },
      required: ['path', 'content', 'message'],
    },
  },
  {
    name: 'github_read_file',
    description: 'Read the content of a file from a GitHub repository.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path in the repo' },
        branch: { type: 'string', description: 'Branch name (default: main)' },
      },
      required: ['repo', 'path'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Create a GitHub issue.',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body (markdown)' },
        labels: { type: 'string', description: 'Comma-separated labels (optional)' },
      },
      required: ['repo', 'title', 'body'],
    },
  },

  // ── Code Execution ───────────────────────────────────────────────────────
  {
    name: 'execute_code',
    description:
      'Execute a Python or JavaScript/Node.js code snippet and return the output. Use for quick calculations, data processing, or testing logic.',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description: 'Programming language: python or javascript',
          enum: ['python', 'javascript'],
        },
        code: { type: 'string', description: 'Code to execute' },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default 10, max 30)',
        },
      },
      required: ['language', 'code'],
    },
  },
];

// Convert to Anthropic tool format
export function toAnthropicTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// Convert to OpenAI/OpenRouter tool format
export function toOpenAITools() {
  return TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
