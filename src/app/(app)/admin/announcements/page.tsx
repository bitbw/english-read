import { AnnouncementManager } from "@/components/announcement/announcement-manager";
import { requireAdminSession } from "@/lib/require-admin";

export default async function AdminAnnouncementsPage() {
  await requireAdminSession();

  return <AnnouncementManager />;
}