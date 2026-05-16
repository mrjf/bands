import { randomBytes } from "crypto";

export function randomId(): string {
  return randomBytes(8).toString("hex");
}
