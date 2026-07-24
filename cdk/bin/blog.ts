#!/usr/bin/env node
/**
 * Entrypoint for the blog.aldolushkja.it CDK app.
 * Deploys the static site (S3 + CloudFront) and, unless disabled, the
 * daily/bi-monthly content pipeline (DynamoDB + Lambda + EventBridge).
 */
import * as cdk from 'aws-cdk-lib';
import { execSync } from 'child_process';
import { BlogSiteStack } from '../lib/blog-site-stack';
import { ContentPipelineStack } from '../lib/content-pipeline-stack';

function resolveAwsProfile(): string | undefined {
  return process.env.AWS_PROFILE || process.env.CDK_DEFAULT_PROFILE;
}

function resolveAwsAccount(): string {
  if (process.env.CDK_DEFAULT_ACCOUNT) {
    return process.env.CDK_DEFAULT_ACCOUNT;
  }
  const profile = resolveAwsProfile();
  const profileArg = profile ? `--profile ${profile}` : '';
  return execSync(`aws sts get-caller-identity ${profileArg} --query Account --output text`, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();
}

function resolveAwsRegion(): string {
  if (process.env.CDK_DEFAULT_REGION) {
    return process.env.CDK_DEFAULT_REGION;
  }
  if (process.env.AWS_REGION) {
    return process.env.AWS_REGION;
  }
  if (process.env.AWS_DEFAULT_REGION) {
    return process.env.AWS_DEFAULT_REGION;
  }
  const profile = resolveAwsProfile();
  const profileArg = profile ? `--profile ${profile}` : '';
  return execSync(`aws configure get region ${profileArg}`, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();
}

const env = {
  account: resolveAwsAccount(),
  region: resolveAwsRegion(),
};

const app = new cdk.App();

const domainName = process.env.DOMAIN_NAME || 'blog.aldolushkja.it';
const certificateArn = process.env.CERTIFICATE_ARN;
const githubRepo = process.env.GITHUB_REPO || 'aldo-lushkja/blog.aldolushkja.it';
const bedrockModelId = process.env.BEDROCK_MODEL_ID;
const stackToDeploy = app.node.tryGetContext('stack');

console.log(`🤜🏻 Deploying blog stacks with config: ${JSON.stringify({ ...env, domainName, stackToDeploy })}`);

if (stackToDeploy && !['site', 'pipeline'].includes(stackToDeploy)) {
  console.error(`❌ Invalid stack name: ${stackToDeploy}. Expected "site" or "pipeline".`);
  process.exit(1);
}

if (stackToDeploy === 'site' || !stackToDeploy) {
  new BlogSiteStack(app, 'BlogSiteStack', { env, domainName, certificateArn });
}

if (stackToDeploy === 'pipeline' || !stackToDeploy) {
  new ContentPipelineStack(app, 'BlogContentPipelineStack', { env, githubRepo, bedrockModelId });
}

app.synth();
