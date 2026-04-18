import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/require-user';

export default async function RootPage() {
  const user = await getServerUser();
  redirect(user ? '/home' : '/sign-in');
}
