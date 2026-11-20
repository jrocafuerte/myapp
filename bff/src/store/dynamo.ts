/**
 * Persistencia en DynamoDB (una tabla, clave `pk`):
 *   USER#<sub>             estado del cliente en el adaptador simulado + `version` (concurrencia optimista)
 *   IDEM#<sub>#<clave>     resultado de una operación idempotente, con TTL de 24 h
 */
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { BankState } from '../../../shared/domain/types';
import { ConflictError, IDEMPOTENCY_TTL_S, type IdempotencyBegin, type StateStore } from './types';

export class DynamoStore implements StateStore {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  constructor(private table: string) {}

  async get(userId: string) {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `USER#${userId}` }, ConsistentRead: true }));
    return r.Item ? { state: JSON.parse(r.Item.state as string) as BankState, version: r.Item.version as number } : null;
  }

  async put(userId: string, state: BankState, expected: number | null) {
    const version = (expected ?? 0) + 1;
    try {
      await this.db.send(new PutCommand({
        TableName: this.table,
        Item: { pk: `USER#${userId}`, state: JSON.stringify(state), version, updatedAt: new Date().toISOString() },
        ConditionExpression: expected === null ? 'attribute_not_exists(pk)' : 'version = :v',
        ExpressionAttributeValues: expected === null ? undefined : { ':v': expected },
      }));
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) throw new ConflictError();
      throw e;
    }
    return version;
  }

  async *listUserIds() {
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.db.send(new ScanCommand({ TableName: this.table, ProjectionExpression: 'pk', FilterExpression: 'begins_with(pk, :u)', ExpressionAttributeValues: { ':u': 'USER#' }, ExclusiveStartKey: start }));
      for (const item of r.Items ?? []) yield String(item.pk).slice(5);
      start = r.LastEvaluatedKey;
    } while (start);
  }

  async beginIdempotent(userId: string, key: string, fingerprint: string): Promise<IdempotencyBegin> {
    const pk = `IDEM#${userId}#${key}`;
    try {
      await this.db.send(new PutCommand({
        TableName: this.table,
        Item: { pk, fingerprint, expiresAt: Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_S },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
      return { status: 'new' };
    } catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) throw e;
    }
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk }, ConsistentRead: true }));
    if (!r.Item) return { status: 'pending' };
    if (r.Item.fingerprint !== fingerprint) return { status: 'mismatch' };
    return r.Item.body !== undefined ? { status: 'done', statusCode: r.Item.statusCode as number, body: r.Item.body as string } : { status: 'pending' };
  }

  async completeIdempotent(userId: string, key: string, statusCode: number, body: string) {
    await this.db.send(new UpdateCommand({ TableName: this.table, Key: { pk: `IDEM#${userId}#${key}` }, UpdateExpression: 'SET statusCode = :s, body = :b', ExpressionAttributeValues: { ':s': statusCode, ':b': body } }));
  }

  async abortIdempotent(userId: string, key: string) {
    await this.db.send(new DeleteCommand({ TableName: this.table, Key: { pk: `IDEM#${userId}#${key}` } }));
  }
}
