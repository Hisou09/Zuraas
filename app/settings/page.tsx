import { requireChatGPTUser } from "../chatgpt-auth";
import { Chrome } from "../components/Chrome";
import { SettingsPage } from "../components/SettingsPage";

export const dynamic="force-dynamic";
export default async function Page(){await requireChatGPTUser("/settings");return <Chrome><SettingsPage/></Chrome>}
