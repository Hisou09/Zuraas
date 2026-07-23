import { isAdmin } from "../../../../../../db/auth";
import { uploadR2Object } from "../../../../../../db/r2-s3";

export const PUT = async (request: Request) => {
  if (!await isAdmin(request)) {
    return Response.json({ error: "Админ эрх шаардлагатай" }, { status: 403 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return Response.json({ error: "Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй" }, { status: 403 });
  }

  const url = new URL(request.url);
  const key = String(url.searchParams.get("key") || "");
  const size = Number(url.searchParams.get("size"));
  const type = String(url.searchParams.get("type") || request.headers.get("content-type") || "application/octet-stream");

  try {
    await uploadR2Object(request, { key, size, type });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("R2 upload proxy failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "R2 upload амжилтгүй" },
      { status: 502 },
    );
  }
};
