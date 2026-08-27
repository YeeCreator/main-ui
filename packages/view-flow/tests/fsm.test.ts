import { describe, expect, test } from 'vitest';
import { createMachine, createInterpreter, createFsmHub, machineToFlowDocument } from '../src/fsm';
import type { MachineDefinition } from '../src/fsm';

const trafficLight: MachineDefinition<{ count: number }> = {
  id: 'traffic-light',
  label: 'Traffic Light',
  initial: 'red',
  context: { count: 0 },
  states: [
    {
      id: 'red', label: 'Red',
      transitions: [{ event: 'TIMER', target: 'green' }],
    },
    {
      id: 'green', label: 'Green',
      transitions: [{ event: 'TIMER', target: 'yellow' }],
    },
    {
      id: 'yellow', label: 'Yellow',
      transitions: [{ event: 'TIMER', target: 'red' }],
    },
  ],
};

describe('createMachine', () => {
  test('initial state is set', () => {
    const m = createMachine(trafficLight);
    expect(m.currentState).toBe('red');
    expect(m.context).toEqual({ count: 0 });
  });

  test('send transitions to next state', () => {
    const m = createMachine(trafficLight);
    const m2 = m.send('TIMER');
    expect(m2).not.toBeNull();
    expect(m2!.currentState).toBe('green');
    // Original unchanged (immutable)
    expect(m.currentState).toBe('red');
  });

  test('invalid event returns null', () => {
    const m = createMachine(trafficLight);
    expect(m.send('INVALID')).toBeNull();
  });

  test('full cycle red → green → yellow → red', () => {
    let m = createMachine(trafficLight);
    m = m.send('TIMER')!;
    expect(m.currentState).toBe('green');
    m = m.send('TIMER')!;
    expect(m.currentState).toBe('yellow');
    m = m.send('TIMER')!;
    expect(m.currentState).toBe('red');
  });

  test('snapshot serializes correctly', () => {
    const m = createMachine(trafficLight);
    const snap = m.snapshot();
    expect(snap).toEqual({ machineId: 'traffic-light', currentState: 'red', context: { count: 0 } });
  });

  test('guard blocks transition', () => {
    const guarded: MachineDefinition<{ locked: boolean }> = {
      id: 'guarded',
      initial: 'a',
      context: { locked: true },
      states: [
        {
          id: 'a',
          transitions: [{
            event: 'GO',
            target: 'b',
            guard: (ctx) => !ctx.locked,
          }],
        },
        { id: 'b', transitions: [] },
      ],
    };
    const m = createMachine(guarded);
    expect(m.send('GO')).toBeNull(); // locked
  });

  test('actions transform context', () => {
    const counter: MachineDefinition<{ count: number }> = {
      id: 'counter',
      initial: 'idle',
      context: { count: 0 },
      states: [
        {
          id: 'idle',
          transitions: [{
            event: 'INC',
            target: 'idle',
            actions: [(ctx) => ({ ...ctx, count: ctx.count + 1 })],
          }],
        },
      ],
    };
    let m = createMachine(counter);
    m = m.send('INC')!;
    expect(m.context.count).toBe(1);
    m = m.send('INC')!;
    expect(m.context.count).toBe(2);
  });
});

describe('createInterpreter', () => {
  test('records transition history', () => {
    const m = createMachine(trafficLight);
    let interp = createInterpreter(m);
    interp = interp.send('TIMER')!;
    interp = interp.send('TIMER')!;
    expect(interp.history).toHaveLength(2);
    expect(interp.history[0]).toMatchObject({ from: 'red', to: 'green', event: 'TIMER' });
    expect(interp.history[1]).toMatchObject({ from: 'green', to: 'yellow', event: 'TIMER' });
  });

  test('invalid send returns null', () => {
    const m = createMachine(trafficLight);
    const interp = createInterpreter(m);
    expect(interp.send('NOPE')).toBeNull();
  });
});

describe('createFsmHub', () => {
  test('register and create machine', () => {
    const hub = createFsmHub();
    hub.register(trafficLight);
    expect(hub.list()).toEqual(['traffic-light']);
    const m = hub.create('traffic-light');
    expect(m).not.toBeNull();
    expect(m!.currentState).toBe('red');
  });

  test('interpret creates interpreter', () => {
    const hub = createFsmHub();
    hub.register(trafficLight);
    const interp = hub.interpret('traffic-light');
    expect(interp).not.toBeNull();
    expect(interp!.machine.currentState).toBe('red');
  });

  test('unknown machine returns null', () => {
    const hub = createFsmHub();
    expect(hub.create('nonexistent')).toBeNull();
  });

  test('unregister removes definition', () => {
    const hub = createFsmHub();
    hub.register(trafficLight);
    hub.unregister('traffic-light');
    expect(hub.list()).toEqual([]);
  });
});

describe('machineToFlowDocument', () => {
  test('converts states to nodes and transitions to edges', () => {
    const doc = machineToFlowDocument(trafficLight);
    expect(doc.nodes).toHaveLength(3);
    expect(doc.edges).toHaveLength(3);
    expect(doc.node_layouts).toHaveLength(3);
    // First node is 'start' type
    expect(doc.nodes[0].node_type).toBe('start');
    // All have ports
    expect(doc.nodes[0].ports).toHaveLength(2);
  });

  test('custom layout options', () => {
    const doc = machineToFlowDocument(trafficLight, { columns: 2, spacingX: 300, spacingY: 200 });
    expect(doc.node_layouts[0]).toEqual({ id: 'red', x: 0, y: 0 });
    expect(doc.node_layouts[1]).toEqual({ id: 'green', x: 300, y: 0 });
    expect(doc.node_layouts[2]).toEqual({ id: 'yellow', x: 0, y: 200 });
  });

  test('edges reference correct port ids', () => {
    const doc = machineToFlowDocument(trafficLight);
    const firstEdge = doc.edges[0];
    expect(firstEdge.source.nodeId).toBe('red');
    expect(firstEdge.target.nodeId).toBe('green');
    expect(firstEdge.signal).toBe('control');
  });
});
