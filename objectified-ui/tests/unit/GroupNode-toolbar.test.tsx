/**
 * Group canvas node: floating edit toolbar (#859).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';

import GroupNode, { type GroupNodeData } from '../../src/app/components/ade/studio/GroupNode';

jest.mock('../../src/app/components/ade/studio/GroupBulkEditDialog', () => ({
  __esModule: true,
  default: () => null,
}));

const baseData: GroupNodeData = {
  id: 'g1',
  name: 'Alpha Group',
  color: 'indigo',
  nodeIds: ['n1'],
};

function renderGroup(overrides?: Partial<GroupNodeData>, selected = false) {
  const data = { ...baseData, ...overrides };
  return render(
    <ReactFlowProvider>
      <GroupNode
        id="g1"
        type="groupNode"
        data={data as unknown as Record<string, unknown>}
        selected={selected}
      />
    </ReactFlowProvider>
  );
}

describe('GroupNode floating toolbar', () => {
  it('does not show style controls when the frame is not hovered or selected', () => {
    renderGroup(undefined, false);
    expect(screen.queryByTitle('Style settings')).not.toBeInTheDocument();
  });

  it('shows style controls when hovering the group surface', () => {
    renderGroup(undefined, false);
    const surface = screen.getByTestId('group-node-surface');
    fireEvent.mouseEnter(surface);
    expect(screen.getByTitle('Style settings')).toBeInTheDocument();
    expect(screen.getByTitle('Change color')).toBeInTheDocument();
  });

  it('shows style controls when selected even without hover', () => {
    renderGroup(undefined, true);
    expect(screen.getByTitle('Style settings')).toBeInTheDocument();
  });

  it('hides toolbar in read-only mode', () => {
    renderGroup({ isReadOnly: true }, true);
    expect(screen.queryByTitle('Style settings')).not.toBeInTheDocument();
  });
});
