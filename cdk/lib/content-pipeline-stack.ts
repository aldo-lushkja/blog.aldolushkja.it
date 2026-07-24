import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';

const LAMBDA_RUNTIME = lambda.Runtime.NODEJS_24_X;

export interface ContentPipelineStackProps extends cdk.StackProps {
  /** owner/repo of the blog content repository the drafter opens PRs against. */
  githubRepo: string;
  /**
   * Bedrock model id (or cross-region inference profile id) used for topic
   * ranking and draft generation. Must have model access enabled in this
   * account/region. Override via context (`-c bedrockModelId=...`) once you
   * know which id is enabled for your account.
   */
  bedrockModelId?: string;
}

/**
 * Name of the single JSON secret (created out-of-band, see README) holding:
 * { "TELEGRAM_BOT_TOKEN": "...", "TELEGRAM_CHAT_ID": "...", "GITHUB_TOKEN": "..." }
 */
const PIPELINE_SECRET_NAME = 'blog/content-pipeline';

export class ContentPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ContentPipelineStackProps) {
    super(scope, id, props);

    const bedrockModelId =
      props.bedrockModelId ??
      this.node.tryGetContext('bedrockModelId') ??
      'anthropic.claude-3-5-sonnet-20241022-v2:0';

    const topicsTable = new dynamodb.Table(this, 'BlogTopicsTable', {
      tableName: 'BlogTopics',
      partitionKey: { name: 'topicId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lets the drafter cheaply pull the highest-scored, not-yet-drafted topics.
    topicsTable.addGlobalSecondaryIndex({
      indexName: 'StatusScoreIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'score', type: dynamodb.AttributeType.NUMBER },
    });

    const pipelineSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'PipelineSecret',
      PIPELINE_SECRET_NAME,
    );

    const bedrockInvokePolicy = new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
      ],
    });

    const sharedEnv = {
      TABLE_NAME: topicsTable.tableName,
      SECRET_NAME: PIPELINE_SECRET_NAME,
      BEDROCK_MODEL_ID: bedrockModelId,
      GITHUB_REPO: props.githubRepo,
    };

    // Both functions share one package.json/lock (lambdas/) so the shared/
    // helpers (lambdas/shared/*) resolve their npm deps via a common
    // ancestor node_modules directory.
    const lambdasRoot = path.join(__dirname, '../../lambdas');

    const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
      functionName: 'blog-topic-collector',
      entry: path.join(lambdasRoot, 'collector/src/index.ts'),
      projectRoot: lambdasRoot,
      depsLockFilePath: path.join(lambdasRoot, 'package-lock.json'),
      handler: 'handler',
      runtime: LAMBDA_RUNTIME,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
      logGroup: new logs.LogGroup(this, 'CollectorLogGroup', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      bundling: { minify: true, sourceMap: true, externalModules: [] },
    });

    const drafterFn = new NodejsFunction(this, 'DrafterFunction', {
      functionName: 'blog-topic-drafter',
      entry: path.join(lambdasRoot, 'drafter/src/index.ts'),
      projectRoot: lambdasRoot,
      depsLockFilePath: path.join(lambdasRoot, 'package-lock.json'),
      handler: 'handler',
      runtime: LAMBDA_RUNTIME,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
      logGroup: new logs.LogGroup(this, 'DrafterLogGroup', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      bundling: { minify: true, sourceMap: true, externalModules: [] },
    });

    for (const fn of [collectorFn, drafterFn]) {
      topicsTable.grantReadWriteData(fn);
      pipelineSecret.grantRead(fn);
      fn.addToRolePolicy(bedrockInvokePolicy);
    }

    // Daily topic collection: RSS sweep -> Bedrock rank/dedupe -> DynamoDB -> Telegram digest.
    new events.Rule(this, 'DailyCollectorRule', {
      ruleName: 'blog-topic-collector-daily',
      schedule: events.Schedule.cron({ minute: '0', hour: '7' }),
      targets: [new targets.LambdaFunction(collectorFn)],
    });

    // Bi-monthly draft generation (1st and 15th): top topic -> Bedrock skeleton -> GitHub PR -> Telegram.
    new events.Rule(this, 'BiMonthlyDrafterRule', {
      ruleName: 'blog-topic-drafter-bimonthly',
      schedule: events.Schedule.cron({ minute: '0', hour: '8', day: '1,15' }),
      targets: [new targets.LambdaFunction(drafterFn)],
    });

    new cdk.CfnOutput(this, 'TopicsTableName', { value: topicsTable.tableName });
    new cdk.CfnOutput(this, 'CollectorFunctionName', { value: collectorFn.functionName });
    new cdk.CfnOutput(this, 'DrafterFunctionName', { value: drafterFn.functionName });
  }
}
