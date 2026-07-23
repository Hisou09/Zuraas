import { headers } from "next/headers";
import { authenticateCookie } from "../db/auth";

export async function getLocalUser() {
  const incoming = await headers();
  return authenticateCookie(incoming.get("cookie"));
}
