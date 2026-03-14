import path from 'node:path';

import { syncDirectoryToS3 } from './sync.mjs';
import { CloudFront } from './aws/cloudfront.mjs';

/**
 * Ensures a required config value is present.
 */
function requireValue(value, key) {
  if (value === undefined || value === '') {
    throw new Error(`Missing required value '${key}'.`);
  }
  return value;
}

/**
 * Main deploy orchestrator:
 * - syncs a local directory to S3
 * - optionally invalidates CloudFront
 */
export class AwsWebDeployer {
  /**
   * @param {object} config
   * @param {string} [config.directory] Local directory to upload (default: dist)
   * @param {string} [config.distDir] Legacy alias for directory
   * @param {string} config.s3Bucket S3 destination (bucket or s3://bucket/prefix)
   * @param {string} [config.cloudFrontDistributionId] Optional CloudFront distribution id
   * @param {string} [config.awsAccessKeyId] Optional AWS access key id
   * @param {string} [config.awsSecretAccessKey] Optional AWS secret access key
   * @param {string} [config.awsSessionToken] Optional AWS session token (STS)
   * @param {string} [config.s3Region] Optional S3 region (e.g. eu-west-1)
   */
  constructor(config = {}) {
    this.config = {
      directory: path.resolve(process.cwd(), config.directory ?? config.distDir ?? 'dist'),
      htmlCache: config.htmlCache ?? 'max-age=60,public',
      assetsCache: config.assetsCache ?? 'max-age=31536000,public,immutable',
      awsCredentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
        sessionToken: config.awsSessionToken,
      },
      s3Region: config.s3Region || undefined,
      s3Bucket: requireValue(config.s3Bucket, 's3Bucket'),
      cloudFrontDistributionId: config.cloudFrontDistributionId,
    };
  }

  /**
   * Creates a deployer instance from process environment variables.
   */
  static fromEnv() {
    // Keep env mapping centralized in one place.
    const env = process.env;
    return new AwsWebDeployer({
      directory: env.DIRECTORY ?? env.DIST_DIR,
      htmlCache: env.HTML_CACHE,
      assetsCache: env.ASSETS_CACHE,
      awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      awsSessionToken: env.AWS_SESSION_TOKEN,
      s3Region: env.AWS_S3_REGION,
      s3Bucket: env.AWS_S3_BUCKET,
      cloudFrontDistributionId: env.AWS_CLOUD_FRONT_DISTRIBUTION_ID,
    });
  }

  /**
   * Runs the deployment flow (S3 sync + optional CloudFront invalidation).
   */
  async deploy() {
    const config = this.config
    this.printConfig()
    
    // 1) Upload/sync local directory to S3.
    await syncDirectoryToS3({
      directory: config.directory,
      htmlCache: config.htmlCache,
      assetsCache: config.assetsCache,
      awsCredentials: config.awsCredentials,
      s3Bucket: config.s3Bucket,
      s3Region: config.s3Region,
    });

    // 2) Optionally invalidate CloudFront cache after upload.
    if (config.cloudFrontDistributionId) {
      await new CloudFront({ credentials: config.awsCredentials }).invalidateDistribution(
        config.cloudFrontDistributionId,
      );
    } else {
      console.log('Skipping CloudFront invalidation (cloudFrontDistributionId not configured).');
    }

    return config;
  }

  printConfig() {
    const config = JSON.parse(JSON.stringify(this.config))

    // Don't print sensitive data
    delete config.awsCredentials.secretAccessKey
    delete config.awsCredentials.sessionToken

    console.log('config', config)
  }
}

export default AwsWebDeployer;
