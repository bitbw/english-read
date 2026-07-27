export type Role = "user" | "admin";

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

export function toRole(role: string | null | undefined): Role {
  return role === "admin" ? "admin" : "user";
}