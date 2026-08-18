'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EscritaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dicas');
  }, [router]);

  return null;
}
