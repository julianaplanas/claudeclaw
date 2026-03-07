import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { toAnthropicTools, toOpenAITools } from './tools.js';
import { readEmails, sendEmail } from '../tools/email.js';
import { readCalendar, createCalendarEvent } from '../tools/calendar.js';
import { readNotes, createNote } from '../tools/notes.js';
import { listRepos, createRepo, writeFile, readFile, createIssue } from '../tools/github.js';
import { executeCode } from '../tools/code.js';
import type { ChatMessage } from '../session/index.js';

const SYSTEM_PROMPT = `You are Openclaw, a powerful personal AI assistant and software engineer. You have access to tools that let you:
- 📧 Read and send emails via Gmail
- 📅 Read and create Google Calendar events
- 📝 Read and create notes in Notion
- 🐙 Manage GitHub repositories: create repos, read/write files, create issues
- 💻 Execute Python and JavaScript code

Guidelines:
- Be concise and action-oriented. Get things done.
- When writing code, prefer writing it to GitHub unless it's a quick calculation.
- Always confirm before sending emails or making irreversible changes.
- If you can't do something with the available tools, say so clearly.
- Format responses for messaging apps: use short paragraphs, avoid heavy markdown.
- For code blocks, use simple text or backticks — avoid complex formatting.
- Today's date: ${new Date().toISOString().split('T')[0]}`;

// ── Tool execution dispatcher ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any;

async function executeTool(name: string, args: AnyArgs): Promise<string> {
  console.log(`[tool] Executing: ${name}`, JSON.stringify(args).substring(0, 200));
  try {
    switch (name) {
      case 'read_emails':
        return await readEmails(args as Parameters<typeof readEmails>[0]);
      case 'send_email':
        return await sendEmail(args as Parameters<typeof sendEmail>[0]);
      case 'read_calendar':
        return await readCalendar(args as Parameters<typeof readCalendar>[0]);
      case 'create_calendar_event':
        return await createCalendarEvent(args as Parameters<typeof createCalendarEvent>[0]);
      case 'read_notes':
        return await readNotes(args as Parameters<typeof readNotes>[0]);
      case 'create_note':
        return await createNote(args as Parameters<typeof createNote>[0]);
      case 'github_list_repos':
        return await listRepos(args as Parameters<typeof listRepos>[0]);
      case 'github_create_repo':
        return await createRepo(args as Parameters<typeof createRepo>[0]);
      case 'github_write_file':
        return await writeFile(args as Parameters<typeof writeFile>[0]);
      case 'github_read_file':
        return await readFile(args as Parameters<typeof readFile>[0]);
      case 'github_create_issue':
        return await createIssue(args as Parameters<typeof createIssue>[0]);
      case 'execute_code':
        return await executeCode(args as Parameters<typeof executeCode>[0]);
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    console.error(`[tool] Error in ${name}:`, err.message);
    return `Error: ${err.message}`;
  }
}

// ── Anthropic agentic loop ───────────────────────────────────────────────────

async function runAnthropicLoop(messages: ChatMessage[]): Promise<string> {
  const client = new Anthropic({ apiKey: config.llm.anthropicApiKey });
  const tools = toAnthropicTools();

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const MAX_ITERATIONS = 10;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: config.llm.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      tools,
    });

    // Collect text content
    const textBlocks = response.content.filter((b) => b.type === 'text') as Anthropic.TextBlock[];
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      return textBlocks.map((b) => b.text).join('\n') || '(no response)';
    }

    // Add assistant message with all content blocks
    anthropicMessages.push({ role: 'assistant', content: response.content });

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>);
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      }),
    );

    anthropicMessages.push({ role: 'user', content: toolResults });
  }

  return 'I reached the maximum number of steps. Please try a more specific request.';
}

// ── OpenRouter / OpenAI agentic loop ─────────────────────────────────────────

async function runOpenRouterLoop(messages: ChatMessage[]): Promise<string> {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.llm.openrouterApiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/openclaw',
      'X-Title': 'Openclaw Personal Assistant',
    },
  });

  const tools = toOpenAITools();

  const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const MAX_ITERATIONS = 10;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.chat.completions.create({
      model: config.llm.model.includes('/') ? config.llm.model : `anthropic/${config.llm.model}`,
      messages: openAIMessages,
      tools,
      max_tokens: 4096,
    });

    const choice = response.choices[0];
    const message = choice.message;

    openAIMessages.push(message);

    if (choice.finish_reason !== 'tool_calls' || !message.tool_calls?.length) {
      return message.content || '(no response)';
    }

    // Execute tools
    for (const toolCall of message.tool_calls) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeTool(toolCall.function.name, args);

      openAIMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  return 'I reached the maximum number of steps. Please try a more specific request.';
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (config.llm.provider === 'anthropic') {
    return runAnthropicLoop(messages);
  } else {
    return runOpenRouterLoop(messages);
  }
}
