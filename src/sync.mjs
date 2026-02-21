import fs from 'node:fs';
import path from 'node:path';

import { S3 } from './aws/s3.mjs';

// Accepts either "s3://bucket/prefix" or "bucket/prefix".
/**
 * Parse user S3 destination input into bucket + prefix.
 */
function parseS3Target(value) {
  const normalized = value.startsWith('s3://') ? value.slice('s3://'.length) : value;
  const clean = normalized.replace(/^\/+|\/+$/g, '');

  if (!clean) throw new Error('s3Bucket is empty.');

  const [bucket, ...rest] = clean.split('/');
  if (!bucket) throw new Error(`Invalid s3Bucket: '${value}'`);

  const basePrefix = rest.join('/').replace(/^\/+|\/+$/g, '');
  return { bucket, basePrefix };
}

/**
 * Builds the final S3 key from base prefix + relative file path.
 */
function joinS3Key(basePrefix, relativePath) {
  return basePrefix ? `${basePrefix}/${relativePath}` : relativePath;
}

/**
 * Recursively collects all files from a directory preserving relative paths.
 */
function walkFiles(baseDir) {
  const files = [];

  // Recursive directory walk to preserve relative paths in S3 keys.
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else {
        const relative = path.relative(baseDir, absolutePath).split(path.sep).join('/');
        files.push({ absolutePath, relativePath: relative });
      }
    }
  }

  walk(baseDir);
  return files;
}

/**
 * Returns a content-type for common static file extensions.
 */
function contentTypeFor(key) {
  // Minimal content-type mapping for common static web artifacts.
  if (key.endsWith('.html')) return 'text/html; charset=utf-8';
  if (key.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (key.endsWith('.css')) return 'text/css; charset=utf-8';
  if (key.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (key.endsWith('.svg')) return 'image/svg+xml';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.ico')) return 'image/x-icon';
  return undefined;
}

/**
 * Syncs a local directory to S3 and removes remote stale objects.
 */
export async function syncDirectoryToS3({
  directory,
  htmlCache,
  assetsCache,
  awsCredentials,
  s3Bucket,
  s3Region,
}) {
  const s3 = new S3({ credentials: awsCredentials, region: s3Region });
  const { bucket, basePrefix } = parseS3Target(s3Bucket);

  const localFiles = walkFiles(directory);
  const localKeys = new Set(localFiles.map((file) => file.relativePath));

  const destinationText = basePrefix ? `s3://${bucket}/${basePrefix}` : `s3://${bucket}`;
  console.log(`Syncing ${localFiles.length} files to ${destinationText}...`);

  for (const file of localFiles) {
    const body = fs.createReadStream(file.absolutePath);

    // Apply short cache to HTML and long cache to hashed assets.
    const cacheControl = file.relativePath.startsWith('assets/')
      ? assetsCache
      : file.relativePath.endsWith('.html')
        ? htmlCache
        : undefined;

    await s3.putObject({
      bucket,
      key: joinS3Key(basePrefix, file.relativePath),
      body,
      cacheControl,
      contentType: contentTypeFor(file.relativePath),
    });
  }

  console.log('Calculating remote objects to delete...');
  const remoteKeys = await s3.listAllKeys({ bucket, prefix: basePrefix });
  const keysToDelete = remoteKeys.filter((fullKey) => {
    const relativeKey = basePrefix ? fullKey.slice(basePrefix.length + 1) : fullKey;
    return !localKeys.has(relativeKey);
  });

  if (keysToDelete.length > 0) {
    console.log(`Deleting ${keysToDelete.length} remote objects not present locally...`);
    await s3.deleteKeysInBatches({ bucket, keys: keysToDelete });
  }
}
