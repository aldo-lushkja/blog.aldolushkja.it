import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ContentPipelineStack } from '../lib/content-pipeline-stack';

// Requires `npm install` in lambdas/ first — NodejsFunction bundles the
// Lambda source with esbuild during synth, which needs the shared
// lambdas/node_modules to resolve @aws-sdk/*, @octokit/rest, rss-parser.
describe('ContentPipelineStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new ContentPipelineStack(app, 'TestContentPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' },
      githubRepo: 'aldolushkja/blog.aldolushkja.it',
    });
    template = Template.fromStack(stack);
  });

  test('Creates the BlogTopics DynamoDB table with a status/score GSI', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'BlogTopics',
    });
  });

  test('Creates the collector and drafter Lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 2);
  });

  test('Creates a daily rule for the collector', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'blog-topic-collector-daily',
    });
  });

  test('Creates a bi-monthly rule for the drafter', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'blog-topic-drafter-bimonthly',
    });
  });
});
