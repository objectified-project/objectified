'use client';

import { signOut, useSession } from 'next-auth/react';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

const Ade = () => {
  const {data: session, status, update} = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (session) {
      console.log('Session:', session, 'status:', status, 'update:', update);
    }

    if (session === null) {
      router.push('/login');
    }
  }, [session]);

  return (
    <>
    </>
  );
}

export default Ade;
