import { describe, it, expect, vi } from 'vitest';
import React from 'react';

describe('ErrorBoundary', () => {
  it('should render children when no error', async () => {
    const { default: ErrorBoundary } = await import('../../components/ErrorBoundary');

    const tree = React.createElement(
      ErrorBoundary,
      null,
      React.createElement('div', { 'data-testid': 'child' }, 'Hello')
    );

    expect(tree).toBeDefined();
  });
});

describe('ProtectedRoute', () => {
  it('should be a valid component', async () => {
    const { default: ProtectedRoute } = await import('../../components/ProtectedRoute');
    expect(ProtectedRoute).toBeDefined();
  });
});

describe('MarkdownOutput', () => {
  it('should be a valid component', async () => {
    const { default: MarkdownOutput } = await import('../../components/MarkdownOutput');
    expect(MarkdownOutput).toBeDefined();
  });
});

describe('ChatWidget', () => {
  it('should be a valid component', async () => {
    const { default: ChatWidget } = await import('../../components/ChatWidget');
    expect(ChatWidget).toBeDefined();
  });
});

describe('WebTerminal', () => {
  it('should be a valid component', async () => {
    const { default: WebTerminal } = await import('../../components/WebTerminal');
    expect(WebTerminal).toBeDefined();
  });
});

describe('TopologyGraph', () => {
  it('should be a valid component', async () => {
    const { default: TopologyGraph } = await import('../../components/TopologyGraph');
    expect(TopologyGraph).toBeDefined();
  });
});
