import { S3Client, CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type S3Config = {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

export function createS3(cfg: S3Config) {
  const common = {
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    },
    forcePathStyle: true
  } as const;

  // Internal endpoint used by the backend container (e.g. http://minio:9000)
  const internalClient = new S3Client({
    ...common,
    endpoint: cfg.endpoint
  });

  // Public endpoint used by browsers (e.g. http://localhost:9000)
  // Important: pre-signed URLs MUST be created with the same host that clients will use,
  // otherwise MinIO/S3 will reject the signature.
  const publicClient = new S3Client({
    ...common,
    endpoint: cfg.publicEndpoint
  });

  return { internalClient, publicClient, cfg };
}

export async function ensureBucket(s3: ReturnType<typeof createS3>) {
  try {
    await s3.internalClient.send(new HeadBucketCommand({ Bucket: s3.cfg.bucket }));
  } catch {
    await s3.internalClient.send(new CreateBucketCommand({ Bucket: s3.cfg.bucket }));
  }
}

export async function putObject(
  s3: ReturnType<typeof createS3>,
  params: { key: string; body: Uint8Array; contentType: string }
) {
  await s3.internalClient.send(
    new PutObjectCommand({
      Bucket: s3.cfg.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType
    })
  );
}

export async function presignGetUrl(
  s3: ReturnType<typeof createS3>,
  params: { key: string; expiresInSeconds: number }
) {
  const url = await getSignedUrl(
    s3.publicClient,
    new GetObjectCommand({
      Bucket: s3.cfg.bucket,
      Key: params.key
    }),
    { expiresIn: params.expiresInSeconds }
  );
  return url;
}

