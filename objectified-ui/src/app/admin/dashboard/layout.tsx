import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/app/utils/adminAuth';
import AdminSidebar from './AdminSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect('/admin');
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-100 dark:bg-gray-900 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

