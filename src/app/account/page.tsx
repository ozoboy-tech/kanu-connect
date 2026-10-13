import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AccountPanel from "./account-panel";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/api/auth/signin?callbackUrl=/account");
  return <main>
    <p><a href="/profile">Mon profil</a></p>
    <h1>Compte et confidentialité</h1>
    <AccountPanel />
  </main>;
}
