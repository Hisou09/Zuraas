import { getLocalUser } from "../local-auth";
import { redirect } from "next/navigation";
import { Chrome } from "../components/Chrome";
import { SettingsPage } from "../components/SettingsPage";

export const dynamic="force-dynamic";
export default async function Page(){if(!await getLocalUser())redirect("/");return <Chrome><SettingsPage/></Chrome>}
