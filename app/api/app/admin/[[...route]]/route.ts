import {
  DELETE as appDelete,
  GET as appGet,
  POST as appPost,
  PUT as appPut,
} from "../../[[...route]]/route";

/**
 * Rebuild the request URL with the public origin supplied by the reverse proxy.
 *
 * The main API route validates write-request origins against request.url. In a
 * container deployment request.url can contain the internal HTTP host while the
 * browser sends the public HTTPS origin, causing valid POST/PUT/DELETE requests
 * to be rejected with 403. Keeping the path and body unchanged while restoring
 * the forwarded public origin lets the existing CSRF check compare like-for-like.
 */
function proxyAwareRequest(request: Request) {
  const url = new URL(request.url);
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

  const protocol = forwardedProto || url.protocol.replace(":", "");
  const publicUrl = new URL(request.url);
  publicUrl.protocol = `${protocol}:`;
  publicUrl.host = host;

  if (publicUrl.origin === url.origin) return request;
  return new Request(publicUrl, request);
}

export const GET = (request: Request) => appGet(proxyAwareRequest(request));
export const POST = (request: Request) => appPost(proxyAwareRequest(request));
export const PUT = (request: Request) => appPut(proxyAwareRequest(request));
export const DELETE = (request: Request) => appDelete(proxyAwareRequest(request));
