import { db } from '@/infrastructure/database/connection';
import { auditLogs } from '@/infrastructure/database/schema';
import { eq, and, desc } from 'drizzle-orm';

export class AuditService {
  async log(data: {
    actorId?: string;
    actorIp?: string;
    actorUserAgent?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    targetUserId?: string;
    details?: any;
    previousValues?: any;
    newValues?: any;
  }) {
    await db.insert(auditLogs).values(data);
  }

  async getLogs(filters: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Build query với filters
    const conditions = [];
    if (filters.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }
    if (filters.resourceId) {
      conditions.push(eq(auditLogs.resourceId, filters.resourceId));
    }

    const result = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }
}

export const auditService = new AuditService();