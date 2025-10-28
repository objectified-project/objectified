// SideNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { User, Users, Building2, FileJson, Database, Code } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface NavSection {
  header: string;
  items: NavItem[];
}

const SideNav: React.FC = () => {
  const pathname = usePathname();

  const navSections: NavSection[] = [
    {
      header: 'Account',
      items: [{ label: 'Profile', href: '/profile', icon: User }],
    },
    {
      header: 'Administration',
      items: [
        { label: 'Groups', href: '/groups', icon: Users },
        { label: 'Tenants', href: '/tenants', icon: Building2 },
      ],
    },
    {
      header: 'Publications',
      items: [
        { label: 'Schemas', href: '/schemas', icon: FileJson },
        { label: 'Databases', href: '/databases', icon: Database },
        { label: 'APIs', href: '/apis', icon: Code },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="w-64 bg-gray-50 dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto" style={{ height: 'calc(100vh - 48px)' }}>
      {navSections.map((section, index) => (
        <div key={section.header} className={index < navSections.length - 1 ? 'mb-6' : ''}>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-3">
            {section.header}
          </h2>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 py-2 px-3 rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

export default SideNav;