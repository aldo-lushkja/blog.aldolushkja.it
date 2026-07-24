import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Topic, TopicStatus } from './types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME environment variable is not set');
  return name;
}

export async function putTopic(topic: Topic): Promise<void> {
  await ddb.send(new PutCommand({ TableName: tableName(), Item: topic }));
}

export async function updateTopicStatus(topicId: string, status: TopicStatus, extra: Record<string, unknown> = {}): Promise<void> {
  const names: Record<string, string> = { '#status': 'status', '#updatedAt': 'updatedAt' };
  const values: Record<string, unknown> = { ':status': status, ':updatedAt': new Date().toISOString() };
  const sets = ['#status = :status', '#updatedAt = :updatedAt'];

  for (const [key, value] of Object.entries(extra)) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    sets.push(`#${key} = :${key}`);
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { topicId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** Returns topics for a status, highest score first. */
export async function getTopicsByStatus(status: TopicStatus, limit = 50): Promise<Topic[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'StatusScoreIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Topic[];
}

/** Full-table scan used to build a dedupe corpus for the collector. Backlog is small (low hundreds), so a scan is fine. */
export async function getAllTopicTitles(): Promise<string[]> {
  const result = await ddb.send(
    new ScanCommand({
      TableName: tableName(),
      ProjectionExpression: 'title',
    }),
  );
  return (result.Items ?? []).map((item) => item.title as string);
}
