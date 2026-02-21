import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Thin S3 helper for upload, list and delete operations.
 */
export class S3 {
  /**
   * @param {object} [options]
   * @param {{accessKeyId:string,secretAccessKey:string}} [options.credentials]
   */
  constructor({ credentials } = {}) {
    this.s3 = new S3Client({ credentials });
  }

  /** Upload a single object to S3. */
  async putObject({ bucket, key, body, cacheControl, contentType }) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        CacheControl: cacheControl,
        ContentType: contentType,
      })
    );
  }

  /** List all keys under an optional prefix. */
  async listAllKeys({ bucket, prefix }) {
    // Handle pagination so callers always receive the full key list.
    const keys = [];
    let continuationToken;

    do {
      const output = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of output.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }

      continuationToken = output.IsTruncated ? output.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  /** Delete multiple keys in batches of up to 1000. */
  async deleteKeysInBatches({ bucket, keys }) {
    // S3 DeleteObjects supports up to 1000 keys per request.
    const batchSize = 1000;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: true,
          },
        })
      );
    }
  }
}
