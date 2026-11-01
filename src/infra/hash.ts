// ROLE: Implements Hash port using Node crypto for cryptographic hashing operations.
// INPUTS: text: string.
// CRITICAL: Uses sha256 algorithm producing standard lowercase hexadecimal digests.

import crypto from 'node:crypto';
import type { Hash } from '../ports/index.js';

export class NodeHash implements Hash {
  sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
