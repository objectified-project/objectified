'use client';

import { useSession } from 'next-auth/react';
import * as React from 'react';

const Ade = () => {
  const { data: session } = useSession();

  return (
    <>
    </>
  );
}

export default Ade;
