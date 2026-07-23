import { env } from "cloudflare:workers";
import { createPresignedS3Url } from "./aws-signature";

type R2UploadDescriptor = {
  key: string;
  size: number;
  type: string;
};

type RuntimeVariables = Record<string, string | undefined>;

function variables(): RuntimeVariables {
  return env as unknown as RuntimeVariables;
}

export function r2ApiConfig() {
  const values = variables();
  const accountId = values.R2_ACCOUNT_ID?.trim();
  const bucket = values.R2_BUCKET_NAME?.trim();
  const accessKeyId = values.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = values.R2_SECRET_ACCESS_KEY?.trim();
  const endpoint = values.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const missing = [
    ["R2_ACCOUNT_ID", accountId],
    ["R2_BUCKET_NAME", bucket],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) throw new Error(`R2 API тохиргоо дутуу байна: ${missing.join(", ")}`);
  return { accountId: accountId!, bucket: bucket!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, endpoint };
}

async function signedUrl(method: "GET" | "PUT" | "HEAD" | "DELETE", key = "", expiresIn = 300) {
  const config = r2ApiConfig();
  return createPresignedS3Url({
    endpoint: config.endpoint,
    bucket: config.bucket,
    key: key || undefined,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    method,
    expiresIn,
  });
}

function safeSegment(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "file";
}

export function createEpisodeObjectKey(input: { contentId: string; number: number; fileName: string; index: number }) {
  return `episodes/${safeSegment(input.contentId)}/${safeSegment(String(input.number))}/${String(input.index + 1).padStart(3, "0")}-${crypto.randomUUID()}-${safeSegment(input.fileName)}`;
}

export function isEpisodeObjectKey(key: string, contentId: string, number: number) {
  return key.startsWith(`episodes/${safeSegment(contentId)}/${safeSegment(String(number))}/`) && !key.includes("..") && key.length <= 900;
}

export async function createR2PresignedUpload(input: R2UploadDescriptor) {
  return { uploadUrl: await signedUrl("PUT", input.key, 3600), expiresIn: 3600 };
}

export async function verifyR2Upload(input: R2UploadDescriptor) {
  if (!input.key || !Number.isFinite(input.size) || input.size <= 0 || !input.type) throw new Error("R2 upload мэдээлэл буруу байна");
}

export function createR2PresignedRead(key: string) {
  return signedUrl("GET", key, 300);
}

export async function deleteR2Object(key: string) {
  const response = await fetch(await signedUrl("DELETE", key), { method: "DELETE" });
  if (!response.ok) throw new Error(`R2 файл устгагдсангүй (${response.status})`);
}

export async function checkR2Connection() {
  const { bucket } = r2ApiConfig();
  return { bucket };
}
