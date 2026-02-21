# aws-deploy

A reusable module to deploy a web build to **AWS S3** and optionally create a
**CloudFront** invalidation.

## What it does

1. Uploads files from a local directory (default: `dist`) to S3.
2. Applies `Cache-Control` for HTML and static assets.
3. Deletes remote S3 objects that no longer exist locally.
4. (Optional) Invalidates `/*` in CloudFront.

## Usage as a module (recommended)

```js
import { AwsWebDeployer } from '@dukebot/aws-deploy';

const deployer = new AwsWebDeployer({
  directory: 'dist',
  s3Bucket: 's3://mi-bucket/mi-app/',
  s3Region: 'eu-west-1', // optional (if omitted, S3 class default is used)
  cloudFrontDistributionId: 'E1234567890ABC', // optional
  awsAccessKeyId: 'AKIA...', // optional
  awsSecretAccessKey: '...', // optional
  awsSessionToken: '...', // optional (STS)
  htmlCache: 'max-age=60,public',
  assetsCache: 'max-age=31536000,public,immutable',
});

await deployer.deploy();
```

You can also create an instance from environment variables:

```js
import { AwsWebDeployer } from '@dukebot/aws-deploy';

const deployer = AwsWebDeployer.fromEnv();
await deployer.deploy();
```

## Environment variables

Supported variables:

- `DIRECTORY` (default: `dist`)
- `DIST_DIR` (legacy compatibility)
- `HTML_CACHE` (default: `max-age=60,public`)
- `ASSETS_CACHE` (default: `max-age=31536000,public,immutable`)
- `AWS_S3_BUCKET` (**required**)
- `AWS_CLOUD_FRONT_DISTRIBUTION_ID` (optional)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional, for temporary credentials)
- `AWS_S3_REGION` (optional, for S3 client region)

You can also provide credentials directly via constructor parameters:

- `awsAccessKeyId`
- `awsSecretAccessKey`
- `awsSessionToken` (optional)
- `s3Region` (optional)

> AWS credentials: this module relies on the standard AWS SDK credential chain
> (environment variables, local profile, IAM role, etc.).

`fromEnv()` reads values from `process.env`.

If you want to use `.env`, load it yourself first (for example with `dotenv/config`)
before creating the deployer.
