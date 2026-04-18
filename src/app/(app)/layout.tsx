import { requireProfile } from '@/lib/auth/require-user';
import { BottomTabs } from '@/components/bottom-tabs';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-md">{children}</main>
      <BottomTabs />
    </div>
  );
}
