'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  GitBranch,
  Box,
  Code,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../../../lib/utils';
import { getDashboardStats, getRecentActivity } from '../../../../lib/db/helper';

interface DashboardStats {
  total_tenants: number;
  admin_tenants: number;
  total_projects: number;
  created_projects: number;
  total_versions: number;
  created_versions: number;
  published_versions: number;
  total_classes: number;
  total_properties: number;
  total_class_properties: number;
  last_activity: string | null;
}

interface RecentActivity {
  type: 'project' | 'version' | 'class' | 'property';
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  tenant_name: string;
  tenant_slug: string;
}

const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total_tenants: 0,
    admin_tenants: 0,
    total_projects: 0,
    created_projects: 0,
    total_versions: 0,
    created_versions: 0,
    published_versions: 0,
    total_classes: 0,
    total_properties: 0,
    total_class_properties: 0,
    last_activity: null,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = (session?.user as any)?.user_id;
  const userName = session?.user?.name || 'User';

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!userId) return;

      setIsLoading(true);
      try {
        const [statsData, activityData] = await Promise.all([
          getDashboardStats(userId),
          getRecentActivity(userId, 10)
        ]);

        setStats(JSON.parse(statsData));
        setRecentActivity(JSON.parse(activityData));
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [userId]);

  const getActivityIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'project':
        return <Folder className={cn(iconClass, "text-purple-500")} />;
      case 'version':
        return <GitBranch className={cn(iconClass, "text-emerald-500")} />;
      case 'class':
        return <Box className={cn(iconClass, "text-cyan-500")} />;
      case 'property':
        return <Code className={cn(iconClass, "text-amber-500")} />;
      default:
        return <Clock className={cn(iconClass, "text-gray-500")} />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'project': return 'Created project';
      case 'version': return 'Created version';
      case 'class': return 'Created class';
      case 'property': return 'Created property';
      default: return 'Activity';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  const statsConfig = [
    {
      icon: Folder,
      label: 'Tenants',
      value: stats.total_tenants,
      subtitle: `${stats.admin_tenants} admin`,
      color: 'blue',
      bgClass: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      hoverBorder: 'hover:border-blue-400',
      hoverShadow: 'hover:shadow-blue-500/20',
    },
    {
      icon: Folder,
      label: 'Projects',
      value: stats.total_projects,
      subtitle: `${stats.created_projects} created`,
      color: 'purple',
      bgClass: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      hoverBorder: 'hover:border-purple-400',
      hoverShadow: 'hover:shadow-purple-500/20',
    },
    {
      icon: GitBranch,
      label: 'Versions',
      value: stats.total_versions,
      subtitle: `${stats.published_versions} published`,
      color: 'emerald',
      bgClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      hoverBorder: 'hover:border-emerald-400',
      hoverShadow: 'hover:shadow-emerald-500/20',
    },
    {
      icon: Box,
      label: 'Classes',
      value: stats.total_classes,
      subtitle: 'schema definitions',
      color: 'cyan',
      bgClass: 'bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      hoverBorder: 'hover:border-cyan-400',
      hoverShadow: 'hover:shadow-cyan-500/20',
    },
    {
      icon: Code,
      label: 'Properties',
      value: stats.total_properties,
      subtitle: `${stats.total_class_properties} in classes`,
      color: 'amber',
      bgClass: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      hoverBorder: 'hover:border-amber-400',
      hoverShadow: 'hover:shadow-amber-500/20',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Welcome back, {userName}!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Here's an overview of your schema projects and activity.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {statsConfig.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card
              key={stat.label}
              className={cn(
                "transition-all duration-300 hover:-translate-y-1",
                stat.hoverBorder,
                stat.hoverShadow,
                "hover:shadow-lg"
              )}
            >
              <CardContent className="p-5">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {stat.label}
                      </span>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bgClass)}>
                        <IconComponent className={cn("h-5 w-5", stat.iconColor)} />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                      {stat.value}
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {stat.subtitle}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Activity
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your latest actions
                </p>
              </div>
            </div>
          </div>

          {/* Activity List */}
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        item.type === 'project' ? 'bg-purple-100 dark:bg-purple-900/30' :
                        item.type === 'version' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        item.type === 'class' ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                        'bg-amber-100 dark:bg-amber-900/30'
                      )}>
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {getActivityLabel(item.type)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="default" className="text-[10px] px-2 py-0">
                            {item.tenant_name}
                          </Badge>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTimeAgo(item.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {index < recentActivity.length - 1 && (
                      <div className="mx-3 border-t border-gray-100 dark:border-gray-800" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  No recent activity
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Start creating projects to see your activity here!
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

