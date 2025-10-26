'use client';

import { useSession } from "next-auth/react"

const Login = () => {
  // `session` will match the returned value of `callbacks.session()` from `NextAuth()`
  const { data: session } = useSession();

  return (
    <>
    </>
  );
}

export default Login;
