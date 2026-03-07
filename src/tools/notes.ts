import { Client } from '@notionhq/client';
import { config } from '../config/index.js';

function getNotionClient() {
  if (!config.notion.token) {
    throw new Error('Notion not configured (NOTION_TOKEN missing)');
  }
  return new Client({ auth: config.notion.token });
}

function richTextToString(richText: any[]): string {
  return richText.map((t: any) => t.plain_text || '').join('');
}

export async function readNotes(args: { query?: string; limit?: number }): Promise<string> {
  if (!config.notion.notesDatabaseId) {
    throw new Error('NOTION_NOTES_DATABASE_ID not configured');
  }

  const notion = getNotionClient();
  const limit = args.limit ?? 10;

  const queryOptions: any = {
    database_id: config.notion.notesDatabaseId,
    page_size: limit,
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
  };

  if (args.query) {
    queryOptions.filter = {
      or: [
        { property: 'Name', title: { contains: args.query } },
        { property: 'Tags', multi_select: { contains: args.query } },
      ],
    };
  }

  const res = await notion.databases.query(queryOptions);

  if (res.results.length === 0) {
    return args.query ? `No notes found matching "${args.query}".` : 'No notes found.';
  }

  const notes = await Promise.all(
    res.results.map(async (page: any) => {
      const title = richTextToString(page.properties?.Name?.title || []);
      const tags = (page.properties?.Tags?.multi_select || [])
        .map((t: any) => t.name)
        .join(', ');
      const lastEdited = page.last_edited_time;

      // Fetch page content blocks
      const blocks = await notion.blocks.children.list({ block_id: page.id, page_size: 20 });
      const content = blocks.results
        .map((block: any) => {
          const type = block.type;
          const text = block[type]?.rich_text;
          return text ? richTextToString(text) : '';
        })
        .filter(Boolean)
        .join('\n')
        .substring(0, 500);

      return `Title: ${title}\nTags: ${tags || 'None'}\nLast edited: ${lastEdited}\nContent:\n${content}${content.length >= 500 ? '...' : ''}`;
    }),
  );

  return notes.join('\n\n---\n\n');
}

export async function createNote(args: {
  title: string;
  content: string;
  tags?: string;
}): Promise<string> {
  if (!config.notion.notesDatabaseId) {
    throw new Error('NOTION_NOTES_DATABASE_ID not configured');
  }

  const notion = getNotionClient();
  const tagList = args.tags
    ? args.tags.split(',').map((t) => ({ name: t.trim() }))
    : [];

  // Split content into paragraphs for Notion blocks
  const paragraphs = args.content
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      object: 'block' as const,
      type: 'paragraph' as const,
      paragraph: {
        rich_text: [{ type: 'text' as const, text: { content: line.substring(0, 2000) } }],
      },
    }));

  const page = await notion.pages.create({
    parent: { database_id: config.notion.notesDatabaseId },
    properties: {
      Name: { title: [{ type: 'text', text: { content: args.title } }] },
      ...(tagList.length > 0 && { Tags: { multi_select: tagList } }),
    },
    children: paragraphs.slice(0, 100), // Notion API limit
  });

  return `Note "${args.title}" created in Notion. ID: ${page.id}`;
}
