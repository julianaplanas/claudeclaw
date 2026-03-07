import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';

export type Platform = 'telegram' | 'whatsapp';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  userId: string;
  platform: Platform;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const MAX_MESSAGES = 30;
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

class SessionManager {
  private memory = new Map<string, Session>();
  private redis: RedisClientType | null = null;

  async init() {
    if (config.redis.url) {
      try {
        this.redis = createClient({ url: config.redis.url }) as RedisClientType;
        this.redis.on('error', (err) => console.error('[redis] error:', err));
        await this.redis.connect();
        console.log('[session] Using Redis for session storage');
      } catch (err) {
        console.warn('[session] Redis connection failed, using in-memory storage:', err);
        this.redis = null;
      }
    } else {
      console.log('[session] Using in-memory session storage (sessions lost on restart)');
    }
  }

  private key(userId: string, platform: Platform) {
    return `openclaw:session:${platform}:${userId}`;
  }

  async get(userId: string, platform: Platform): Promise<Session> {
    const k = this.key(userId, platform);

    if (this.redis) {
      const raw = await this.redis.get(k);
      if (raw) return JSON.parse(raw) as Session;
    } else {
      const s = this.memory.get(k);
      if (s) return s;
    }

    const session: Session = {
      userId,
      platform,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.save(k, session);
    return session;
  }

  async addUserMessage(userId: string, platform: Platform, content: string) {
    const session = await this.get(userId, platform);
    session.messages.push({ role: 'user', content, timestamp: Date.now() });
    session.updatedAt = Date.now();
    this.trim(session);
    await this.save(this.key(userId, platform), session);
  }

  async addAssistantMessage(userId: string, platform: Platform, content: string) {
    const session = await this.get(userId, platform);
    session.messages.push({ role: 'assistant', content, timestamp: Date.now() });
    session.updatedAt = Date.now();
    this.trim(session);
    await this.save(this.key(userId, platform), session);
  }

  async clear(userId: string, platform: Platform) {
    const k = this.key(userId, platform);
    if (this.redis) {
      await this.redis.del(k);
    } else {
      this.memory.delete(k);
    }
  }

  private trim(session: Session) {
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
  }

  private async save(k: string, session: Session) {
    if (this.redis) {
      await this.redis.set(k, JSON.stringify(session), { EX: TTL_SECONDS });
    } else {
      this.memory.set(k, session);
    }
  }
}

export const sessionManager = new SessionManager();
