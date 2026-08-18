import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isAdminCodeValid(candidate: string | null): boolean {
  const expected = process.env.ADMIN_CODE;
  if (!candidate || !expected) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
