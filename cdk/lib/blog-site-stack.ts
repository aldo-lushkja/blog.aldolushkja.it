import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';

// Shared parent hosted zone reused across all *.aldolushkja.it sites.
const PARENT_ZONE_NAME = 'aldolushkja.it';
const PARENT_ZONE_ID = 'Z089198921OSYO5ZZMZYZ';

export interface BlogSiteStackProps extends cdk.StackProps {
  domainName: string;
  certificateArn?: string;
}

export class BlogSiteStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: BlogSiteStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: domainName,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'ParentZone', {
      hostedZoneId: PARENT_ZONE_ID,
      zoneName: PARENT_ZONE_NAME,
    });

    let certificate: acm.ICertificate;
    if (props.certificateArn) {
      certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn);
    } else {
      certificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
        domainName,
        hostedZone: zone,
        region: 'us-east-1', // CloudFront certificates must be in us-east-1
      });
    }

    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `${this.stackName}-security-headers`,
      comment: 'Baseline security headers for the blog',
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; " +
            "script-src 'self'; font-src 'self' data:; connect-src 'self'; base-uri 'self'; " +
            "frame-ancestors 'none'; object-src 'none'",
          override: true,
        },
      },
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
      },
      domainNames: [domainName],
      certificate,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.minutes(5) },
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.minutes(5) },
      ],
    });

    // recordName is the domain with the shared parent zone suffix stripped, e.g.
    // "blog.aldolushkja.it" -> "blog", "dev.blog.aldolushkja.it" -> "dev.blog".
    const recordName = domainName.endsWith(`.${PARENT_ZONE_NAME}`)
      ? domainName.slice(0, -(PARENT_ZONE_NAME.length + 1))
      : domainName;

    new route53.ARecord(this, 'SiteAliasRecord', {
      zone,
      recordName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
    });

    const frontendPath = path.join(__dirname, '../../frontend');
    const commitSha = process.env.GITHUB_SHA
      ? process.env.GITHUB_SHA.substring(0, 7)
      : execSync('git rev-parse --short HEAD', { cwd: frontendPath }).toString().trim();

    const frontendAsset = s3Deploy.Source.asset(frontendPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry('node:24'),
        environment: { COMMIT_SHA: commitSha },
        command: ['bash', '-c', 'npm ci && npm run build && cp -r dist/* /asset-output'],
        user: 'root',
      },
    });

    new s3Deploy.BucketDeployment(this, 'SiteDeployment', {
      destinationBucket: siteBucket,
      sources: [frontendAsset],
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    new ssm.StringParameter(this, 'DistributionIdParameter', {
      parameterName: '/blog/frontend/distribution-id',
      stringValue: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new cdk.CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
  }
}
