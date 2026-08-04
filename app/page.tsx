import { HomeClient } from "./home-client";
import { getCurrentViewer } from "./viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentViewer();

  return (
    <HomeClient
      initialUser={user}
    />
  );
}
