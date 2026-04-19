import { requireAdmin } from '@/lib/auth/require-user';
import { AdminNav } from '@/components/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminNav />
      <main className="flex-1 p-4 md:p-6 mx-auto w-full max-w-4xl">{children}</main>
    </div>
  );
}
