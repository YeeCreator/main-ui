/**
 * FSM → FlowDocument 单向映射（纯函数）。
 *
 * 将 FSM 机器定义转换为 FlowDocument 流程图表示，
 * 供 FlowCanvas / FlowView 渲染。反向解析（flowDocumentToMachine）
 * 为 v0.6 增强项。
 */

import type { FlowDocument, FlowEdgeData, FlowNodeData, FlowNodeLayout, FlowPortDef } from '../types';
import type { MachineDefinition, StateDefinition } from './types';

/** 为 FSM 状态生成标准端口（一个 input + 一个 output）。 */
const stateToPorts = (state: StateDefinition): FlowPortDef[] => [
  { id: `${state.id}:in`, direction: 'input', signal: 'control', label: 'in' },
  { id: `${state.id}:out`, direction: 'output', signal: 'control', label: 'out' },
];

/** FSM 状态类型映射为 FlowNode node_type。 */
const resolveNodeType = (state: StateDefinition, initial: string): string => {
  if (state.id === initial) return 'start';
  if (state.transitions.length === 0) return 'end';
  return 'state';
};

/**
 * machineToFlowDocument：将 FSM 定义转换为流程图文档（纯函数）。
 *
 * 布局采用简单网格排列（每行 4 个节点），宿主可后续自行调整。
 */
export const machineToFlowDocument = (
  machine: MachineDefinition,
  options?: { columns?: number; spacingX?: number; spacingY?: number },
): FlowDocument => {
  const cols = options?.columns ?? 4;
  const spacingX = options?.spacingX ?? 220;
  const spacingY = options?.spacingY ?? 140;

  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];
  const node_layouts: FlowNodeLayout[] = [];

  machine.states.forEach((state, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    nodes.push({
      id: state.id,
      node_type: resolveNodeType(state, machine.initial),
      label: state.label ?? state.id,
      ports: stateToPorts(state),
      content: state.meta ? { ...state.meta, fsmStateId: state.id } : { fsmStateId: state.id },
    });

    node_layouts.push({
      id: state.id,
      x: col * spacingX,
      y: row * spacingY,
    });

    // 转换 → 控制流边
    for (const transition of state.transitions) {
      edges.push({
        id: `${state.id}→${transition.target}:${transition.event}`,
        source: { nodeId: state.id, portId: `${state.id}:out` },
        target: { nodeId: transition.target, portId: `${transition.target}:in` },
        signal: 'control',
        label: transition.event,
      });
    }
  });

  return { nodes, edges, node_layouts };
};
