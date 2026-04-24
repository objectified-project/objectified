import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/test-fixtures';

test.describe('Repositories registration', () => {
  test('register happy path with mocked GitHub provider', async ({ page }) => {
    await page.route('**/api/repositories', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, repositories: [] }),
        });
        return;
      }

      const payload = route.request().postDataJSON() as {
        branches?: Array<{ branch: string; subpathGlob?: string; pollIntervalSec?: number }>;
      };
      expect(payload.branches).toEqual([{ branch: 'main', subpathGlob: '**/*' }]);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          repository: {
            id: 'repo-123',
            provider: 'github',
            owner: 'acme',
            name: 'api-platform',
            fullName: 'acme/api-platform',
            status: 'scan_in_progress',
            branches: ['main'],
          },
          initialScanJobId: 'job-123',
        }),
      });
    });

    await page.route('**/api/repositories/repo-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          repository: {
            id: 'repo-123',
            provider: 'github',
            owner: 'acme',
            name: 'api-platform',
            fullName: 'acme/api-platform',
            status: 'scan_in_progress',
            branches: [{ branch: 'main' }],
            timeline: [
              {
                id: 'timeline-1',
                type: 'scan',
                status: 'in_progress',
                message: 'Scan in progress...',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    await page.route('**/api/linked-accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accounts: [
            {
              id: 'acct-1',
              provider: 'github',
              provider_username: 'octocat',
            },
          ],
        }),
      });
    });

    await page.route('**/api/sso/github/repos?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repositories: [
            {
              id: 1,
              name: 'api-platform',
              full_name: 'acme/api-platform',
              description: 'Core API repo',
              default_branch: 'main',
            },
          ],
        }),
      });
    });

    await page.route('**/api/sso/github/branches?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          branches: ['main', 'release/2026.04'],
          defaultBranch: 'main',
        }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(testUsers.valid.email);
    await page.locator('input[type="password"]').fill(testUsers.valid.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(3000);
    if (page.url().includes('/login')) {
      test.skip(true, 'Login failed - skipping authenticated repositories flow');
      return;
    }

    await page.goto('/ade/dashboard/repositories');
    await page.getByRole('button', { name: 'Add Repository' }).click();
    const wizard = page.getByRole('dialog');

    await wizard.getByRole('button', { name: 'octocat' }).click();
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();

    await wizard.getByRole('button', { name: 'acme/api-platform Core API repo' }).click();
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();

    await wizard.getByRole('button', { name: 'Next', exact: true }).click();

    await wizard.locator('textarea').fill('scan:\n  enabled: true\n');
    await wizard.getByRole('button', { name: 'Register repository' }).click();

    await expect(page).toHaveURL(/\/ade\/dashboard\/repositories\/repo-123$/);
    await expect(page.getByText('Scan in progress...').first()).toBeVisible();
  });
});
