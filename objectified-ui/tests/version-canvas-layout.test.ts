import { rowToLayoutState } from '../lib/version-canvas-layout';

describe('rowToLayoutState', () => {
  test('parses string JSON columns into LayoutState', () => {
    const row = {
      viewport: '{"x":1,"y":2,"zoom":0.5}',
      nodes: '[{"id":"a","position":{"x":0,"y":0},"data":{"name":"N"}}]',
      edges: '[{"id":"e1","source":"a","target":"b"}]',
      grid_settings: '{"snapToGrid":true}',
      minimap_settings: '{}',
    };
    const s = rowToLayoutState(row);
    expect(s.viewport).toEqual({ x: 1, y: 2, zoom: 0.5 });
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes![0].id).toBe('a');
    expect(s.edges).toHaveLength(1);
    expect(s.grid_settings).toEqual({ snapToGrid: true });
  });

  test('accepts already-parsed objects', () => {
    const row = {
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [{ id: 'x', position: { x: 10, y: 20 } }],
      edges: [],
    };
    const s = rowToLayoutState(row);
    expect(s.nodes).toHaveLength(1);
    expect(s.edges).toEqual([]);
  });
});
