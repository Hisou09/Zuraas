import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { AdminDashboard } from "../components/AdminDashboard";
import { database,ensureSchema,OWNER_EMAIL } from "../../db/runtime";

export const dynamic="force-dynamic";
export default async function Page(){const user=await getChatGPTUser();if(!user)redirect("/signin-with-chatgpt?return_to=%2Fadmin");await ensureSchema();const role=user.email.toLowerCase()===OWNER_EMAIL?"admin":(await database().prepare("SELECT role FROM users WHERE email=?").bind(user.email).first<{role:string}>())?.role;if(role!=="admin")redirect("/");return <AdminDashboard/>}
