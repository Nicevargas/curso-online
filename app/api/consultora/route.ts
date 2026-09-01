import { NextRequest } from 'next/server';
import { POST as consultorHandler } from '../consultor/route';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return consultorHandler(req);
}

