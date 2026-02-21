import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

/**
 * Minimal CloudFront helper for cache invalidation after deploy.
 */
export class CloudFront {
  /**
   * @param {object} [options]
   * @param {{accessKeyId:string,secretAccessKey:string}} [options.credentials]
   */
  constructor({ region = 'us-east-1', credentials } = {}) {
    // CloudFront is global; us-east-1 is the standard endpoint region.
    this.cloudFront = new CloudFrontClient({ region, credentials });
  }

  /**
   * Invalidates all paths (/*) for a distribution.
   */
  async invalidateDistribution(distributionId) {
    console.log('Creating CloudFront invalidation (/*)...');

    await this.cloudFront.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `deploy-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: ['/*'],
          },
        },
      })
    );
  }
}
