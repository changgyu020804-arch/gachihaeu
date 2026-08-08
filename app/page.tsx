import { HomeClient } from "@/app/home-client";
import { getCurrentViewer } from "@/server/services/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentViewer();

  return (
    <HomeClient
      initialUser={user}
    />
  );
}
