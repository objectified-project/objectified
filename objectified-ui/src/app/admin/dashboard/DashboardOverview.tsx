'use client';

import { Users, DollarSign, UserCheck, Activity, AlertCircle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendUp }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="p-2 bg-red-600/20 rounded-lg">
        {icon}
      </div>
      {trend && (
        <span className={`text-sm font-medium ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
          {trend}
        </span>
      )}
    </div>
    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-white text-2xl font-bold">{value}</p>
  </div>
);

export default function DashboardOverview() {
  return (
    <>
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Users"
            value="—"
            icon={<Users className="w-6 h-6 text-red-400" />}
            trend="+12%"
            trendUp={true}
          />
          <StatCard
            title="Active Subscriptions"
            value="—"
            icon={<UserCheck className="w-6 h-6 text-red-400" />}
            trend="+8%"
            trendUp={true}
          />
          <StatCard
            title="Revenue (MTD)"
            value="—"
            icon={<DollarSign className="w-6 h-6 text-red-400" />}
            trend="+15%"
            trendUp={true}
          />
          <StatCard
            title="System Status"
            value="Healthy"
            icon={<Activity className="w-6 h-6 text-green-400" />}
          />
        </div>

        {/* Info Banner */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-blue-400 font-semibold text-sm mb-1">
              Admin Portal - Initial Setup
            </h3>
            <p className="text-blue-300 text-sm">
              This is the foundation for your super admin portal. Use the sidebar to navigate between different management sections.
              The User Management section is now fully implemented with signup approval and user management features.
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-auto pt-6 border-t border-gray-700">
          <div className="text-center text-gray-500 text-sm">
            <p>Super Admin Portal • Objectified Internal Use Only</p>
            <p className="mt-1">Session expires after 8 hours of inactivity</p>
          </div>
        </div>
      </main>
    </>
  );
}

