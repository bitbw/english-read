export type Role = "user" | "admin";

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}