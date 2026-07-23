import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLocalUser } from "../local-auth";
import { AdminDashboard } from "../components/AdminDashboard";
import { database,ensureSchema,isAdminEmail } from "../../db/runtime";

export const dynamic="force-dynamic";
export default async function Page(){
  const incoming=await headers();
  const userAgent=incoming.get("user-agent")||"";
  const isMobile=/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent);
  if(isMobile)redirect("/");
  const user=await getLocalUser();
  if(!user)redirect("/");
  await ensureSchema();
  const role=isAdminEmail(user.email)?"admin":(await database().prepare("SELECT role FROM users WHERE email=?").bind(user.email).first<{role:string}>())?.role;
  if(role!=="admin")redirect("/");
  return <AdminDashboard/>;
}
