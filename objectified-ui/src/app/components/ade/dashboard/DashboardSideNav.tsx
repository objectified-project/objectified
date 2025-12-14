// SideNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { useSession } from 'next-auth/react';
import { User, Building2, Folders, FileDigit, Key, Eye, Link as LinkIcon } from 'lucide-react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useColorScheme } from '@mui/material/styles';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
}

interface NavSection {
  header: string;
  items: NavItem[];
}

const DashboardSideNav: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { mode, systemMode } = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark');

  const currentTenantId = (session?.user as any)?.current_tenant_id;
  const hasTenant = !!currentTenantId;

  console.log('Current Tenant ID:', currentTenantId);

  const navSections: NavSection[] = [
    {
      header: 'Account',
      items: [
        { label: 'Profile', href: '/ade/dashboard/profile', icon: User },
        { label: 'Linked Accounts', href: '/ade/dashboard/linked-accounts', icon: LinkIcon },
      ],
    },
    {
      header: 'Administration',
      items: [
        { label: 'Tenants', href: '/ade/dashboard/tenants', icon: Building2 },
        { label: 'API Keys', href: '/ade/dashboard/api-keys', icon: Key, disabled: !hasTenant },
      ],
    },
    {
      header: 'Specifications',
      items: [
        { label: 'Projects', href: '/ade/dashboard/projects', icon: Folders, disabled: !hasTenant },
        { label: 'Versions', href: '/ade/dashboard/versions', icon: FileDigit, disabled: !hasTenant },
        { label: 'Published', href: '/ade/dashboard/published', icon: Eye, disabled: !hasTenant },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
          top: 48, // Offset for top header
          height: 'calc(100vh - 48px)',
          borderRight: 'none',
          background: isDark
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: isDark
            ? '4px 0 24px rgba(0, 0, 0, 0.3)'
            : '4px 0 24px rgba(0, 0, 0, 0.06)',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', p: 2.5 }}>
        {navSections.map((section, index) => (
          <Box key={section.header} sx={{ mb: index < navSections.length - 1 ? 3 : 0 }}>
            <Typography
              variant="overline"
              sx={{
                px: 1.5,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 700,
                color: isDark ? '#94a3b8' : '#64748b',
                letterSpacing: '0.08em',
                fontSize: '0.65rem',
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: '#6366f1',
                  opacity: 0.6,
                }}
              />
              {section.header}
            </Typography>
            <List disablePadding sx={{ mt: 0.5 }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={item.disabled ? 'div' : Link}
                      href={item.disabled ? undefined : item.href}
                      disabled={item.disabled}
                      selected={active}
                      sx={{
                        borderRadius: 2,
                        py: 1.25,
                        px: 1.5,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: 'rgba(99, 102, 241, 0.08)',
                          transform: 'translateX(4px)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(99, 102, 241, 0.1)',
                          borderLeft: '3px solid #6366f1',
                          borderRadius: '0 8px 8px 0',
                          ml: -0.5,
                          pl: 2,
                          '&:hover': {
                            bgcolor: 'rgba(99, 102, 241, 0.15)',
                          },
                          '& .MuiListItemIcon-root': {
                            color: '#6366f1',
                          },
                          '& .MuiListItemText-primary': {
                            color: '#6366f1',
                          },
                        },
                        '&.Mui-disabled': {
                          opacity: 0.4,
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          color: active ? '#6366f1' : (isDark ? '#94a3b8' : '#64748b'),
                          transition: 'color 0.2s ease',
                        }}
                      >
                        <Icon size={20} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        slotProps={{
                          primary: {
                            fontSize: '0.875rem',
                            fontWeight: active ? 600 : 500,
                            color: active ? '#6366f1' : (isDark ? '#e2e8f0' : '#334155'),
                          },
                        }}
                      />
                      {active && (
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#6366f1',
                            boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)',
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            {index < navSections.length - 1 && (
              <Divider sx={{ my: 2, borderColor: 'rgba(99, 102, 241, 0.1)' }} />
            )}
          </Box>
        ))}
      </Box>
    </Drawer>
  );
};

export default DashboardSideNav;