import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  return <HomeView username={user.username} />;
}
