import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Application from './application.tsx';

describe('Application', () => {
  it('renders its heading', () => {
    render(<Application />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
