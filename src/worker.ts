import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Redis } from "ioredis";
import sharp from "sharp";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Must match files-api's src/queue.ts.
const THUMBNAIL_QUEUE = "files:thumbnail-jobs";
type ThumbnailJob = { fileId: string; key: string; contentType: string };

const redis = new Redis(required("REDIS_URL"));
const bucket = required("S3_BUCKET");
const apiUrl = required("API_URL");
const internalToken = required("INTERNAL_TOKEN");
const s3 = new S3Client({
  endpoint: required("S3_ENDPOINT"),
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY"),
    secretAccessKey: required("S3_SECRET_KEY"),
  },
});

async function thumbnail(job: ThumbnailJob) {
  if (!job.contentType.startsWith("image/")) {
    console.log(`skip ${job.key}: ${job.contentType} is not an image`);
    return;
  }
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: job.key }));
  const input = Buffer.from(await object.Body!.transformToByteArray());
  const output = await sharp(input)
    .resize(480, 320, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
  const thumbKey = `thumbs/${job.fileId}.webp`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: output,
      ContentType: "image/webp",
    }),
  );
  const res = await fetch(`${apiUrl}/api/internal/files/${job.fileId}/thumbnail`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ key: thumbKey }),
  });
  if (!res.ok) throw new Error(`api answered ${res.status}`);
  console.log(`thumbnail ${thumbKey} for ${job.key}`);
}

console.log(`files-worker waiting on ${THUMBNAIL_QUEUE}`);
for (;;) {
  const popped = await redis.brpop(THUMBNAIL_QUEUE, 0);
  if (!popped) continue;
  const job = JSON.parse(popped[1]) as ThumbnailJob;
  try {
    await thumbnail(job);
  } catch (err) {
    // Back on the queue: most failures here are the api not being up yet.
    console.error(`failed ${job.key}: ${(err as Error).message}; retrying in 5s`);
    await new Promise((r) => setTimeout(r, 5000));
    await redis.rpush(THUMBNAIL_QUEUE, popped[1]);
  }
}
