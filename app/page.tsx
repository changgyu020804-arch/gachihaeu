import { getSessionUser } from "./auth";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <HomeClient
      initialUser={user}
    />
  );
}
