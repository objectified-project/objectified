/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PathsHttpOperationPalette from '../../src/app/ade/studio/paths/components/PathsHttpOperationPalette';
import { PALETTE_HTTP_METHODS } from '../../src/app/ade/studio/paths/components/paths-operation-colors';

jest.mock('../../src/app/hooks/useDarkMode', () => ({
  useDarkMode: () => false,
}));

describe('PathsHttpOperationPalette', () => {
  it('renders palette methods and sets drag payload', () => {
    render(<PathsHttpOperationPalette />);

    for (const method of PALETTE_HTTP_METHODS) {
      expect(screen.getByRole('button', { name: method })).toBeInTheDocument();
    }

    const getBtn = screen.getByRole('button', { name: 'GET' });
    const dt = {
      setData: jest.fn(),
      effectAllowed: '',
    } as unknown as DataTransfer;
    fireEvent.dragStart(getBtn, { dataTransfer: dt });

    expect(dt.setData).toHaveBeenCalledWith(
      'application/json',
      expect.stringContaining('"type":"operation"')
    );
    expect(dt.setData).toHaveBeenCalledWith(
      'application/json',
      expect.stringContaining('"operation":"GET"')
    );
  });
});
