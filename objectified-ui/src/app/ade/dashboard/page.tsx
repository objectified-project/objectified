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
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Skeleton,
} from '@mui/material';
import {
  Folder as FolderIcon,
  AccountTree as VersionIcon,
  Class as ClassIcon,
  Code as PropertyIcon,
  ArrowForward as ArrowForwardIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    tenants: 0,
    projects: 0,
    versions: 0,
    classes: 0,
    properties: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const userName = session?.user?.name || 'User';

  useEffect(() => {
    // Simulate loading stats - replace with actual API calls
    const loadStats = async () => {
      setIsLoading(true);
      // TODO: Replace with actual database queries
      setTimeout(() => {
        setStats({
          tenants: 3,
          projects: 12,
          versions: 24,
          classes: 45,
          properties: 187,
        });
        setIsLoading(false);
      }, 500);
    };

    loadStats();
  }, [currentTenantId]);

  const quickActions = [
    {
      title: 'Manage Tenants',
      description: 'Create and manage your tenants',
      icon: <FolderIcon />,
      href: '/ade/dashboard/tenants',
      color: '#3b82f6',
    },
    {
      title: 'View Projects',
      description: 'Browse and manage projects',
      icon: <FolderIcon />,
      href: '/ade/dashboard/projects',
      color: '#8b5cf6',
    },
    {
      title: 'Open Studio',
      description: 'Design schemas visually',
      icon: <ClassIcon />,
      href: '/ade/studio',
      color: '#06b6d4',
    },
    {
      title: 'Manage Versions',
      description: 'Track schema versions',
      icon: <VersionIcon />,
      href: '/ade/dashboard/versions',
      color: '#10b981',
    },
  ];

  const recentActivity = [
    { action: 'Created class', name: 'User', time: '2 hours ago' },
    { action: 'Updated version', name: 'v1.2.0', time: '5 hours ago' },
    { action: 'Added property', name: 'email', time: '1 day ago' },
    { action: 'Created project', name: 'E-commerce API', time: '2 days ago' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Welcome back, {userName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {/*Here's what's happening with your schemas today.*/}
        </Typography>
      </Box>

      {/* Stats Cards */}
      {/*<Grid container spacing={3} sx={{ mb: 4 }}>*/}
      {/*  {[*/}
      {/*    { icon: <FolderIcon sx={{ color: '#3b82f6', mr: 1 }} />, label: 'Tenants', value: stats.tenants },*/}
      {/*    { icon: <FolderIcon sx={{ color: '#8b5cf6', mr: 1 }} />, label: 'Projects', value: stats.projects },*/}
      {/*    { icon: <VersionIcon sx={{ color: '#10b981', mr: 1 }} />, label: 'Versions', value: stats.versions },*/}
      {/*    { icon: <ClassIcon sx={{ color: '#06b6d4', mr: 1 }} />, label: 'Classes', value: stats.classes },*/}
      {/*    { icon: <PropertyIcon sx={{ color: '#f59e0b', mr: 1 }} />, label: 'Properties', value: stats.properties },*/}
      {/*  ].map((stat) => (*/}
      {/*    <Grid key={stat.label} {...({ item: true, xs: 6, sm: 4, md: 2 } as any)}>*/}
      {/*      <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>*/}
      {/*        <CardContent>*/}
      {/*          {isLoading ? (*/}
      {/*            <Skeleton variant="rectangular" height={80} />*/}
      {/*          ) : (*/}
      {/*            <>*/}
      {/*              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>*/}
      {/*                {stat.icon}*/}
      {/*                <Typography variant="caption" color="text.secondary">*/}
      {/*                  {stat.label}*/}
      {/*                </Typography>*/}
      {/*              </Box>*/}
      {/*              <Typography variant="h4" sx={{ fontWeight: 700 }}>*/}
      {/*                {stat.value}*/}
      {/*              </Typography>*/}
      {/*            </>*/}
      {/*          )}*/}
      {/*        </CardContent>*/}
      {/*      </Card>*/}
      {/*    </Grid>*/}
      {/*  ))}*/}
      {/*</Grid>*/}

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid {...({ item: true, xs: 12, md: 8 } as any)}>
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              {quickActions.map((action) => (
                <Grid key={action.title} {...({ item: true, xs: 12, sm: 6 } as any)}>
                  <Card
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                        borderColor: action.color,
                      },
                    }}
                    onClick={() => router.push(action.href)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: `${action.color}15`,
                            color: action.color,
                            mr: 2,
                          }}
                        >
                          {action.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {action.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {action.description}
                          </Typography>
                        </Box>
                        <ArrowForwardIcon sx={{ color: 'text.secondary' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Recent Activity */}
      {/*  <Grid {...({ item: true, xs: 12, md: 4 } as any)}>*/}
      {/*    <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>*/}
      {/*      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>*/}
      {/*        Recent Activity*/}
      {/*      </Typography>*/}
      {/*      <List sx={{ py: 0 }}>*/}
      {/*        {recentActivity.map((item, index) => (*/}
      {/*          <Box key={index}>*/}
      {/*            <ListItem sx={{ px: 0 }}>*/}
      {/*              <ListItemIcon sx={{ minWidth: 36 }}>*/}
      {/*                <ScheduleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />*/}
      {/*              </ListItemIcon>*/}
      {/*              <ListItemText*/}
      {/*                primary={*/}
      {/*                  <Typography variant="body2">*/}
      {/*                    <strong>{item.action}</strong> {item.name}*/}
      {/*                  </Typography>*/}
      {/*                }*/}
      {/*                secondary={item.time}*/}
      {/*              />*/}
      {/*            </ListItem>*/}
      {/*            {index < recentActivity.length - 1 && <Divider />}*/}
      {/*          </Box>*/}
      {/*        ))}*/}
      {/*      </List>*/}
      {/*      <Button*/}
      {/*        fullWidth*/}
      {/*        variant="outlined"*/}
      {/*        sx={{ mt: 2 }}*/}
      {/*        endIcon={<ArrowForwardIcon />}*/}
      {/*      >*/}
      {/*        View All Activity*/}
      {/*      </Button>*/}
      {/*    </Paper>*/}
      {/*  </Grid>*/}
      </Grid>

      {/* No Tenant Warning */}
      {!currentTenantId && (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 3,
            border: 1,
            borderColor: 'warning.main',
            bgcolor: 'warning.light',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            ⚠️ No Tenant Selected
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please select a tenant to start managing your schemas and projects.
          </Typography>
          <Button
            variant="contained"
            color="warning"
            onClick={() => router.push('/ade/dashboard/tenants')}
          >
            Select Tenant
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default Dashboard;
