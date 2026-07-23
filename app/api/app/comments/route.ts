import {
  GET as appGet,
  POST as appPost,
} from "../[[...route]]/route";

/**
 * Restore the browser-facing origin before the catch-all API middleware runs.
 * Coolify terminates HTTPS at the reverse proxy, so request.url may otherwise
 * contain the internal HTTP origin and valid comment POST requests are rejected
 * by the same-origin check with 403.
 */
function proxyAwareRequest(request: Request) {
  const internalUrl = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();

  if (!host) return request;

  const publicUrl = new URL(request.url);
  publicUrl.protocol = `${forwardedProto || internalUrl.protocol.replace(":", "")}:`;
  publicUrl.host = host;

  return publicUrl.origin === internalUrl.origin
    ? request
    : new Request(publicUrl, request);
}

export const GET = (request: Request) => appGet(proxyAwareRequest(request));
export const POST = (request: Request) => appPost(proxyAwareRequest(request));
