type PresignInput = {
  endpoint: string;
  bucket: string;
  key?: string;
  accessKeyId: string;
  secretAccessKey: string;
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  expiresIn: number;
  now?: Date;
};

const encoder = new TextEncoder();

function rfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(key: Uint8Array, value: string) {
  const imported = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}

export async function createPresignedS3Url(input: PresignInput) {
  const endpoint = new URL(input.endpoint);
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const objectPath = input.key
    ? `/${rfc3986(input.bucket)}/${input.key.split("/").map(rfc3986).join("/")}`
    : `/${rfc3986(input.bucket)}`;
  const canonicalUri = `${basePath}${objectPath}` || "/";
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ].sort(([left], [right]) => left.localeCompare(right));
  const canonicalQuery = query.map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`).join("&");
  const canonicalRequest = [input.method, canonicalUri, canonicalQuery, `host:${endpoint.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join("\n");
  const dateKey = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), dateStamp);
  const regionKey = await hmac(dateKey, "auto");
  const serviceKey = await hmac(regionKey, "s3");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const importedSigningKey = await crypto.subtle.importKey("raw", signingKey as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = toHex(await crypto.subtle.sign("HMAC", importedSigningKey, encoder.encode(stringToSign)));

  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
