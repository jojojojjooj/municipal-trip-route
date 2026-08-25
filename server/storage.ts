import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageBackend = "s3" | "forge" | "missing";

type S3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
};

let s3Client: S3Client | null = null;
let s3ClientFingerprint = "";

export function resolveStorageBackend(
  env: NodeJS.ProcessEnv = process.env
): StorageBackend {
  if (env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    return "s3";
  }
  if (env.BUILT_IN_FORGE_API_URL && env.BUILT_IN_FORGE_API_KEY) {
    return "forge";
  }
  return "missing";
}

function getS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  if (resolveStorageBackend(env) !== "s3") return null;
  return {
    bucket: env.S3_BUCKET as string,
    region: env.S3_REGION || "auto",
    endpoint: env.S3_ENDPOINT?.replace(/\/+$/, "") || undefined,
    accessKeyId: env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") || undefined,
  };
}

function getS3Client(config: S3Config): S3Client {
  const fingerprint = JSON.stringify({
    region: config.region,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    forcePathStyle: config.forcePathStyle,
  });
  if (!s3Client || s3ClientFingerprint !== fingerprint) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    s3ClientFingerprint = fingerprint;
  }
  return s3Client;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3Config = getS3Config();
  if (s3Config) {
    await getS3Client(s3Config).send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return {
      key,
      url: s3Config.publicBaseUrl
        ? `${s3Config.publicBaseUrl}/${key}`
        : `s3://${s3Config.bucket}/${key}`,
    };
  }

  const { forgeUrl, forgeKey } = getForgeConfig();

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3Config = getS3Config();
  if (s3Config) {
    return {
      key,
      url: s3Config.publicBaseUrl
        ? `${s3Config.publicBaseUrl}/${key}`
        : `s3://${s3Config.bucket}/${key}`,
    };
  }
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const s3Config = getS3Config();
  if (s3Config) {
    const configuredSeconds = Number(
      process.env.S3_SIGNED_URL_EXPIRES_SECONDS ?? "900"
    );
    const expiresIn = Number.isFinite(configuredSeconds)
      ? Math.min(Math.max(Math.floor(configuredSeconds), 60), 3600)
      : 900;
    return getSignedUrl(
      getS3Client(s3Config),
      new GetObjectCommand({ Bucket: s3Config.bucket, Key: key }),
      { expiresIn }
    );
  }

  const { forgeUrl, forgeKey } = getForgeConfig();

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
