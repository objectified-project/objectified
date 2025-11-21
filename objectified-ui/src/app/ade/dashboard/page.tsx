'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  AccountTree as VersionIcon,
  Class as ClassIcon,
  Code as PropertyIcon,
  ArrowForward as ArrowForwardIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
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

  // const quickActions = [
  //   {
  //     title: 'Manage Tenants',
  //     description: 'Create and manage your tenants',
  //     icon: <FolderIcon />,
  //     href: '/ade/dashboard/tenants',
  //     color: '#3b82f6',
  //   },
  //   {
  //     title: 'View Projects',
  //     description: 'Browse and manage projects',
  //     icon: <FolderIcon />,
  //     href: '/ade/dashboard/projects',
  //     color: '#8b5cf6',
  //   },
  //   {
  //     title: 'Open Studio',
  //     description: 'Design schemas visually',
  //     icon: <ClassIcon />,
  //     href: '/ade/studio',
  //     color: '#06b6d4',
  //   },
  //   {
  //     title: 'Manage Versions',
  //     description: 'Track schema versions',
  //     icon: <VersionIcon />,
  //     href: '/ade/dashboard/versions',
  //     color: '#10b981',
  //   },
  // ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <FolderIcon sx={{ fontSize: 20, color: '#8b5cf6' }} />;
      case 'version':
        return <VersionIcon sx={{ fontSize: 20, color: '#10b981' }} />;
      case 'class':
        return <ClassIcon sx={{ fontSize: 20, color: '#06b6d4' }} />;
      case 'property':
        return <PropertyIcon sx={{ fontSize: 20, color: '#f59e0b' }} />;
      default:
        return <ScheduleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'project':
        return 'Created project';
      case 'version':
        return 'Created version';
      case 'class':
        return 'Created class';
      case 'property':
        return 'Created property';
      default:
        return 'Activity';
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Welcome back, {userName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's an overview of your schema projects and activity.
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            icon: <FolderIcon sx={{ color: '#3b82f6', mr: 1 }} />,
            label: 'Tenants',
            value: stats.total_tenants,
            subtitle: `${stats.admin_tenants} admin`
          },
          {
            icon: <FolderIcon sx={{ color: '#8b5cf6', mr: 1 }} />,
            label: 'Projects',
            value: stats.total_projects,
            subtitle: `${stats.created_projects} created`
          },
          {
            icon: <VersionIcon sx={{ color: '#10b981', mr: 1 }} />,
            label: 'Versions',
            value: stats.total_versions,
            subtitle: `${stats.published_versions} published`
          },
          {
            icon: <ClassIcon sx={{ color: '#06b6d4', mr: 1 }} />,
            label: 'Classes',
            value: stats.total_classes,
            subtitle: 'schema definitions'
          },
          {
            icon: <PropertyIcon sx={{ color: '#f59e0b', mr: 1 }} />,
            label: 'Properties',
            value: stats.total_properties,
            subtitle: `${stats.total_class_properties} in classes`
          },
        ].map((stat) => (
          <Grid key={stat.label} {...({ item: true, xs: 12, sm: 6, md: 4, lg: 2.4 } as any)}>
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', height: '100%' }}>
              <CardContent>
                {isLoading ? (
                  <Skeleton variant="rectangular" height={80} />
                ) : (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {stat.icon}
                      <Typography variant="caption" color="text.secondary">
                        {stat.label}
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.subtitle}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        {/*<Grid {...({ item: true, xs: 12, md: 8 } as any)}>*/}
        {/*  <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>*/}
        {/*    <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>*/}
        {/*      Quick Actions*/}
        {/*    </Typography>*/}
        {/*    <Grid container spacing={2}>*/}
        {/*      {quickActions.map((action) => (*/}
        {/*        <Grid key={action.title} {...({ item: true, xs: 12, sm: 6 } as any)}>*/}
        {/*          <Card*/}
        {/*            elevation={0}*/}
        {/*            sx={{*/}
        {/*              border: 1,*/}
        {/*              borderColor: 'divider',*/}
        {/*              cursor: 'pointer',*/}
        {/*              transition: 'all 0.2s',*/}
        {/*              '&:hover': {*/}
        {/*                transform: 'translateY(-2px)',*/}
        {/*                boxShadow: 2,*/}
        {/*                borderColor: action.color,*/}
        {/*              },*/}
        {/*            }}*/}
        {/*            onClick={() => router.push(action.href)}*/}
        {/*          >*/}
        {/*            <CardContent>*/}
        {/*              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>*/}
        {/*                <Box*/}
        {/*                  sx={{*/}
        {/*                    width: 40,*/}
        {/*                    height: 40,*/}
        {/*                    borderRadius: 2,*/}
        {/*                    display: 'flex',*/}
        {/*                    alignItems: 'center',*/}
        {/*                    justifyContent: 'center',*/}
        {/*                    bgcolor: `${action.color}15`,*/}
        {/*                    color: action.color,*/}
        {/*                    mr: 2,*/}
        {/*                  }}*/}
        {/*                >*/}
        {/*                  {action.icon}*/}
        {/*                </Box>*/}
        {/*                <Box sx={{ flex: 1 }}>*/}
        {/*                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>*/}
        {/*                    {action.title}*/}
        {/*                  </Typography>*/}
        {/*                  <Typography variant="body2" color="text.secondary">*/}
        {/*                    {action.description}*/}
        {/*                  </Typography>*/}
        {/*                </Box>*/}
        {/*                <ArrowForwardIcon sx={{ color: 'text.secondary' }} />*/}
        {/*              </Box>*/}
        {/*            </CardContent>*/}
        {/*          </Card>*/}
        {/*        </Grid>*/}
        {/*      ))}*/}
        {/*    </Grid>*/}
        {/*  </Paper>*/}
        {/*</Grid>*/}

        {/* Recent Activity */}
        <Grid {...({ item: true, xs: 12, md: 4 } as any)}>
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Recent Activity
            </Typography>
            {isLoading ? (
              <Box>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : recentActivity.length > 0 ? (
              <List sx={{ py: 0 }}>
                {recentActivity.map((item, index) => (
                  <Box key={item.id}>
                    <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        {getActivityIcon(item.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            <strong>{getActivityLabel(item.type)}</strong>
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              {item.name}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Chip
                                label={item.tenant_name}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {formatTimeAgo(item.created_at)}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TrendingUpIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  No recent activity yet. Start creating projects!
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
