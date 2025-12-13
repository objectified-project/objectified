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
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 1.5
        }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',
          }}>
            <TrendingUpIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', letterSpacing: '-0.02em' }}>
              Welcome back, {userName}!
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748b', mt: 0.5 }}>
              Here's an overview of your schema projects and activity.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {[
          {
            icon: <FolderIcon sx={{ fontSize: 24 }} />,
            label: 'Tenants',
            value: stats.total_tenants,
            subtitle: `${stats.admin_tenants} admin`,
            color: '#3b82f6',
            bgGradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          },
          {
            icon: <FolderIcon sx={{ fontSize: 24 }} />,
            label: 'Projects',
            value: stats.total_projects,
            subtitle: `${stats.created_projects} created`,
            color: '#8b5cf6',
            bgGradient: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
          },
          {
            icon: <VersionIcon sx={{ fontSize: 24 }} />,
            label: 'Versions',
            value: stats.total_versions,
            subtitle: `${stats.published_versions} published`,
            color: '#10b981',
            bgGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          },
          {
            icon: <ClassIcon sx={{ fontSize: 24 }} />,
            label: 'Classes',
            value: stats.total_classes,
            subtitle: 'schema definitions',
            color: '#06b6d4',
            bgGradient: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
          },
          {
            icon: <PropertyIcon sx={{ fontSize: 24 }} />,
            label: 'Properties',
            value: stats.total_properties,
            subtitle: `${stats.total_class_properties} in classes`,
            color: '#f59e0b',
            bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          },
        ].map((stat) => (
          <Grid key={stat.label} {...({ item: true, xs: 12, sm: 6, md: 4, lg: 2.4 } as any)}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                background: 'white',
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'visible',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 24px ${stat.color}20`,
                  borderColor: `${stat.color}40`,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                {isLoading ? (
                  <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
                ) : (
                  <>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2.5
                    }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontSize: '0.7rem',
                        }}
                      >
                        {stat.label}
                      </Typography>
                      <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2.5,
                        background: stat.bgGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: stat.color,
                      }}>
                        {stat.icon}
                      </Box>
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 800,
                        mb: 0.5,
                        color: '#1e293b',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                      }}
                    >
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
        <Grid {...({ item: true, xs: 12, md: 6, lg: 5 } as any)}>
          <Paper
            elevation={0}
            sx={{
              p: 0,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'rgba(0, 0, 0, 0.06)',
              height: '100%',
              overflow: 'hidden',
              background: 'white',
            }}
          >
            {/* Section Header */}
            <Box sx={{
              px: 3,
              py: 2.5,
              borderBottom: '1px solid',
              borderColor: 'rgba(99, 102, 241, 0.1)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  p: 1,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ScheduleIcon sx={{ color: 'white', fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Recent Activity
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Your latest actions
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Activity List */}
            <Box sx={{ p: 2 }}>
              {isLoading ? (
                <Box sx={{ px: 1 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} height={70} sx={{ mb: 1, borderRadius: 2 }} />
                  ))}
                </Box>
              ) : recentActivity.length > 0 ? (
                <List sx={{ py: 0 }}>
                  {recentActivity.map((item, index) => (
                    <Box key={item.id}>
                      <ListItem
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(99, 102, 241, 0.04)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 44 }}>
                          <Box sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2,
                            bgcolor: item.type === 'project' ? 'rgba(139, 92, 246, 0.1)' :
                                    item.type === 'version' ? 'rgba(16, 185, 129, 0.1)' :
                                    item.type === 'class' ? 'rgba(6, 182, 212, 0.1)' :
                                    'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {getActivityIcon(item.type)}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: '#334155',
                                mb: 0.25,
                              }}
                            >
                              {getActivityLabel(item.type)}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#64748b',
                                  mb: 0.75,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {item.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Chip
                                  label={item.tenant_name}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                                    color: '#6366f1',
                                    border: 'none',
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#94a3b8',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  {formatTimeAgo(item.created_at)}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentActivity.length - 1 && (
                        <Divider sx={{ mx: 2, borderColor: 'rgba(0, 0, 0, 0.04)' }} />
                      )}
                    </Box>
                  ))}
                </List>
              ) : (
                <Box sx={{
                  textAlign: 'center',
                  py: 6,
                  px: 3,
                }}>
                  <Box sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}>
                    <TrendingUpIcon sx={{ fontSize: 32, color: '#6366f1' }} />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#334155', mb: 0.5 }}>
                    No recent activity
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    Start creating projects to see your activity here!
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
