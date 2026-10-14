import { breakfast } from './breakfast';
import { savoury } from './savoury';
import { desserts } from './desserts';
import { drinks } from './drinks';
import type { Extra } from './types';

export type { Extra } from './types';
export const extras: Record<string, Extra> = { ...breakfast, ...savoury, ...desserts, ...drinks };
