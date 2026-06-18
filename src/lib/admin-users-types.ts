export type AdminUserSummary = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  lastOnlineAt: string | null;
  totalReadingSeconds: number;
  totalReviewSeconds: number;
};
