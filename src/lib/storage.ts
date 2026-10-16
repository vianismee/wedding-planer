import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// File disimpan di MinIO/S3 (bucket privat) bila S3_ENDPOINT diisi, atau di .data/uploads untuk development.
// Klien tidak pernah mendapat URL permanen: akses selalu lewat /api/files/[id] yang memeriksa peran.

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");
const s3 = process.env.S3_ENDPOINT
  ? new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? "", secretAccessKey: process.env.S3_SECRET_KEY ?? "" },
    })
  : null;
const BUCKET = process.env.S3_BUCKET ?? "rukun-private";

export const MAX_UPLOAD = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

function localPath(key: string) {
  const p = path.join(LOCAL_DIR, key);
  if (!p.startsWith(LOCAL_DIR)) throw new Error("Kunci file tidak valid");
  return p;
}

export async function putObject(key: string, body: Buffer, mime: string) {
  if (s3) {
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: mime, ServerSideEncryption: "AES256" }),
    );
    return;
  }
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

/** URL bertanda tangan (10 menit) untuk S3, atau null bila memakai penyimpanan lokal. */
export async function signedUrl(key: string, filename: string) {
  if (!s3) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: 600 },
  );
}

export async function readLocal(key: string) {
  return fs.readFile(localPath(key));
}

export async function deleteObject(key: string) {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return;
  }
  await fs.rm(localPath(key), { force: true });
}
