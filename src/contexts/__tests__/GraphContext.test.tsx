import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GraphProvider, useGraph, useGraphActions } from '../GraphContext';

// Test component to access the context
function TestComponent() {
  const { state } = useGraph();
  const actions = useGraphActions();

  return (
    <div>
      <div data-testid="active-view">{state.activeView}</div>
      <div data-testid="node-count">{state.nodeCount}</div>
      <div data-testid="edge-count">{state.edgeCount}</div>
      <div data-testid="is-loading">{state.isLoading.toString()}</div>
      <button 
        data-testid="set-inheritance"
        onClick={() => actions.setActiveView('inheritance')}
      >
        Set Inheritance
      </button>
      <button 
        data-testid="set-stats"
        onClick={() => actions.setGraphStats({ nodeCount: 10, edgeCount: 20 })}
      >
        Set Stats
      </button>
    </div>
  );
}

describe('GraphContext', () => {
  it('provides initial state', () => {
    render(
      <GraphProvider>
        <TestComponent />
      </GraphProvider>
    );

    expect(screen.getByTestId('active-view')).toHaveTextContent('inheritance');
    expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    expect(screen.getByTestId('edge-count')).toHaveTextContent('0');
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
  });

  it('updates active view', () => {
    render(
      <GraphProvider>
        <TestComponent />
      </GraphProvider>
    );

    act(() => {
      screen.getByTestId('set-inheritance').click();
    });

    expect(screen.getByTestId('active-view')).toHaveTextContent('inheritance');
  });

  it('updates graph stats', () => {
    render(
      <GraphProvider>
        <TestComponent />
      </GraphProvider>
    );

    act(() => {
      screen.getByTestId('set-stats').click();
    });

    expect(screen.getByTestId('node-count')).toHaveTextContent('10');
    expect(screen.getByTestId('edge-count')).toHaveTextContent('20');
  });
});