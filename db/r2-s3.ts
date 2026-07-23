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
  // Upload through our own origin instead of sending the browser directly to
  // r2.cloudflarestorage.com. This avoids bucket-CORS failures while preserving
  // streaming, so large videos are not buffered in application memory.
  const query = new URLSearchParams({ key: input.key, size: String(input.size), type: input.type });
  return { uploadUrl: `/api/app/admin/r2/upload-proxy?${query.toString()}`, expiresIn: 3600 };
}

export async function uploadR2Object(request: Request, descriptor: R2UploadDescriptor) {
  if (!descriptor.key || descriptor.key.includes("..") || !descriptor.key.startsWith("episodes/") || descriptor.key.length > 900) {
    throw new Error("R2 object key буруу байна");
  }
  if (!Number.isFinite(descriptor.size) || descriptor.size <= 0 || !descriptor.type) {
    throw new Error("R2 upload мэдээлэл буруу байна");
  }
  if (!request.body) throw new Error("Upload файл хоосон байна");

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== descriptor.size) {
    throw new Error("Upload файлын хэмжээ зөрүүтэй байна");
  }

  const response = await fetch(await signedUrl("PUT", descriptor.key, 3600), {
    method: "PUT",
    headers: { "content-type": descriptor.type },
    body: request.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`R2 upload амжилтгүй (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}

export async function verifyR2Upload(input: R2UploadDescriptor) {
  if (!input.key || !Number.isFinite(input.size) || input.size <= 0 || !input.type) throw new Error("R2 upload мэдээлэл буруу байна");
  const response = await fetch(await signedUrl("HEAD", input.key), { method: "HEAD" });
  if (!response.ok) throw new Error(`R2 дээр upload файл олдсонгүй (${response.status})`);
  const storedSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(storedSize) && storedSize > 0 && storedSize !== input.size) {
    throw new Error("R2 дээрх файлын хэмжээ зөрүүтэй байна");
  }
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
