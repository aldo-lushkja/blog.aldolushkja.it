import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { PipelineSecrets } from './types';

const client = new SecretsManagerClient({});

let cached: PipelineSecrets | undefined;

/**
 * Fetches the pipeline's single JSON secret (see README for the expected
 * shape) and caches it for the lifetime of the execution environment.
 */
export async function getPipelineSecrets(): Promise<PipelineSecrets> {
  if (cached) return cached;

  const secretName = process.env.SECRET_NAME;
  if (!secretName) throw new Error('SECRET_NAME environment variable is not set');

  const result = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  if (!result.SecretString) throw new Error(`Secret ${secretName} has no SecretString value`);

  cached = JSON.parse(result.SecretString) as PipelineSecrets;
  return cached;
}
