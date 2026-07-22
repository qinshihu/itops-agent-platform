/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Builder (Aggregator)
 */

import { upChunk1 } from './chunk_1';
import { upChunk2 } from './chunk_2';
import { upChunk3 } from './chunk_3';
import { upChunk4 } from './chunk_4';
import { upChunk5 } from './chunk_5';

export function buildUpSql(): string {
  return upChunk1() +
    upChunk2() +
    upChunk3() +
    upChunk4() +
    upChunk5();
}
