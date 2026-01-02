/**
 * Unit Tests for Path Tags Database Functions
 * Tests the CRUD operations for path_tags in helper-paths.ts
 */

import {
  getTagsForPath,
  assignTagToPath,
  removeTagFromPath,
  setPathTags,
} from '../../lib/db/helper-paths';

// Mock the database connection pool
jest.mock('../../lib/db/db', () => ({
  query: jest.fn(),
}));

const connectionPool = require('../../lib/db/db');

describe('Path Tags Database Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTagsForPath', () => {
    it('should return tags for a valid path ID', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTags = [
        {
          id: '1',
          path_id: mockPathId,
          tag_id: 'tag1',
          tag_name: 'User Management',
          tag_color: '#3B82F6',
          tag_description: 'User domain operations',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          path_id: mockPathId,
          tag_id: 'tag2',
          tag_name: 'Public API',
          tag_color: '#10B981',
          tag_description: 'Public endpoints',
          created_at: new Date().toISOString(),
        },
      ];

      connectionPool.query.mockResolvedValue({ rows: mockTags });

      const result = await getTagsForPath(mockPathId);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(mockTags);
      expect(connectionPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT pt.id, pt.path_id, pt.tag_id'),
        [mockPathId]
      );
    });

    it('should return empty array when path has no tags', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      connectionPool.query.mockResolvedValue({ rows: [] });

      const result = await getTagsForPath(mockPathId);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      connectionPool.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await getTagsForPath(mockPathId);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });
  });

  describe('assignTagToPath', () => {
    it('should assign a tag to a path successfully', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = '789e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        id: 'pt1',
        path_id: mockPathId,
        tag_id: mockTagId,
        created_at: new Date().toISOString(),
      };

      connectionPool.query
        .mockResolvedValueOnce({ rows: [mockResult], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockResult,
              tag_name: 'User Management',
              tag_color: '#3B82F6',
            },
          ],
        });

      const result = await assignTagToPath(mockPathId, mockTagId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.path_tag).toBeDefined();
      expect(parsed.path_tag.tag_name).toBe('User Management');
    });

    it('should handle conflict when tag already assigned', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = '789e4567-e89b-12d3-a456-426614174000';

      connectionPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pt1',
              path_id: mockPathId,
              tag_id: mockTagId,
              tag_name: 'User Management',
              tag_color: '#3B82F6',
            },
          ],
          rowCount: 1,
        });

      const result = await assignTagToPath(mockPathId, mockTagId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.already_existed).toBe(true);
    });

    it('should return error on database failure', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = '789e4567-e89b-12d3-a456-426614174000';

      connectionPool.query.mockRejectedValue(new Error('Foreign key violation'));

      const result = await assignTagToPath(mockPathId, mockTagId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('removeTagFromPath', () => {
    it('should remove a tag from a path successfully', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = '789e4567-e89b-12d3-a456-426614174000';

      connectionPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await removeTagFromPath(mockPathId, mockTagId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(connectionPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM odb.path_tags'),
        [mockPathId, mockTagId]
      );
    });

    it('should return error when tag assignment not found', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = '789e4567-e89b-12d3-a456-426614174000';

      connectionPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await removeTagFromPath(mockPathId, mockTagId);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Tag assignment not found');
    });
  });

  describe('setPathTags', () => {
    it('should replace all tags with new set', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagIds = ['tag1', 'tag2', 'tag3'];

      connectionPool.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({}) // INSERT
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [] }); // getTagsForPath

      const result = await setPathTags(mockPathId, mockTagIds);

      expect(connectionPool.query).toHaveBeenCalledWith('BEGIN');
      expect(connectionPool.query).toHaveBeenCalledWith(
        'DELETE FROM odb.path_tags WHERE path_id = $1',
        [mockPathId]
      );
      expect(connectionPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO odb.path_tags'),
        expect.arrayContaining([mockPathId, ...mockTagIds])
      );
      expect(connectionPool.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should clear all tags when empty array provided', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagIds: string[] = [];

      connectionPool.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({}) // COMMIT (no INSERT for empty array)
        .mockResolvedValueOnce({ rows: [] }); // getTagsForPath

      const result = await setPathTags(mockPathId, mockTagIds);

      expect(connectionPool.query).toHaveBeenCalledWith('BEGIN');
      expect(connectionPool.query).toHaveBeenCalledWith(
        'DELETE FROM odb.path_tags WHERE path_id = $1',
        [mockPathId]
      );
      expect(connectionPool.query).toHaveBeenCalledWith('COMMIT');
      // Should not call INSERT for empty array
      expect(connectionPool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO odb.path_tags'),
        expect.anything()
      );
    });

    it('should rollback transaction on error', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagIds = ['tag1', 'tag2'];

      connectionPool.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT fails
        .mockResolvedValueOnce({}); // ROLLBACK

      const result = await setPathTags(mockPathId, mockTagIds);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(connectionPool.query).toHaveBeenCalledWith('BEGIN');
      expect(connectionPool.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle transaction with multiple tags', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagIds = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];

      connectionPool.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({}) // INSERT
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [] }); // getTagsForPath

      await setPathTags(mockPathId, mockTagIds);

      const insertCall = connectionPool.query.mock.calls.find((call: any[]) =>
        call[0].includes('INSERT INTO odb.path_tags')
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('($1, $2)');
      expect(insertCall[0]).toContain('($1, $3)');
      expect(insertCall[0]).toContain('($1, $4)');
      expect(insertCall[0]).toContain('($1, $5)');
      expect(insertCall[0]).toContain('($1, $6)');
    });
  });

  describe('Error Handling', () => {
    it('should handle null or undefined path IDs', async () => {
      connectionPool.query.mockRejectedValue(new Error('Invalid path ID'));

      const result = await getTagsForPath(null as any);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it('should handle malformed UUIDs gracefully', async () => {
      connectionPool.query.mockRejectedValue(new Error('Invalid UUID format'));

      const result = await getTagsForPath('invalid-uuid');
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support workflow: assign multiple tags, then replace with different set', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';

      // First, assign tags individually
      connectionPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'pt1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'pt1', tag_name: 'Tag 1' }] });

      await assignTagToPath(mockPathId, 'tag1');

      connectionPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'pt2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'pt2', tag_name: 'Tag 2' }] });

      await assignTagToPath(mockPathId, 'tag2');

      // Then replace all tags
      connectionPool.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({}) // INSERT
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [] }); // getTagsForPath

      await setPathTags(mockPathId, ['tag3', 'tag4']);

      expect(connectionPool.query).toHaveBeenCalledWith(
        'DELETE FROM odb.path_tags WHERE path_id = $1',
        [mockPathId]
      );
    });

    it('should support workflow: assign tag, remove it, verify empty', async () => {
      const mockPathId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTagId = 'tag1';

      // Assign
      connectionPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'pt1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'pt1', tag_name: 'Tag 1' }] });

      await assignTagToPath(mockPathId, mockTagId);

      // Remove
      connectionPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await removeTagFromPath(mockPathId, mockTagId);

      // Verify empty
      connectionPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getTagsForPath(mockPathId);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });
  });
});

