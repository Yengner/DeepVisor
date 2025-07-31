import React from 'react';
import { NodeStatusIndicator } from '@/components/node-status-indicator';
import { Handle, Position } from '@xyflow/react';
import { Loader, Text } from '@mantine/core';
import { NodeTooltip, NodeTooltipContent, NodeTooltipTrigger } from '@/components/node-tooltip';
import { BaseNode, BaseNodeContent } from '@/components/base-node';


/* eslint-disable @typescript-eslint/no-explicit-any */

export type NodeProps = {
  data: Record<string, any>;
};

function getHandles(type: 'input' | 'output' | 'default' | 'group') {
  switch (type) {
    case 'input':
      return <Handle type='source' position={Position.Bottom} />;
    case 'output':
      return <Handle type='target' position={Position.Top} />;
    case 'default':
      return (
        <>
          <Handle type='target' position={Position.Top} />
          <Handle type='source' position={Position.Bottom} id='a' />
          <Handle type='source' position={Position.Bottom} id='b' />
        </>
      );
    case 'group':
      return null;
  }
}

export function getNodeStatus(
  step: string,
  progress?: Array<{ step: string; status: string; meta: Record<string, any> }>
): 'loading' | 'success' | 'error' | 'initial' {
  const entries = progress?.filter((p) => p.step === step) || [];
  if (entries.some((e) => e.status === 'success')) return 'success';
  if (entries.some((e) => e.status === 'error')) return 'error';
  if (entries.some((e) => e.status === 'loading')) return 'loading';
  return 'initial';
}

export function getNodeMetaForLoading(
  step: string,
  progress: Array<{ step: string; status: string; meta: Record<string, any> }>
): Record<string, any> {
  const entry =
    progress.find((p) => p.step === step && p.status === 'loading') ||
    { meta: {} };
  return entry.meta;
}

export const CustomNode = ({ data }: NodeProps) => {
  const status = getNodeStatus(data.step, data.progress);
  const isLoading = status === 'loading';
  const label = data.label || 'Node';
  const type = data.type || 'default';
  const meta = getNodeMetaForLoading(data.step, data.progress);

  const rows = Object.entries(meta).map(([key, value]) => (
    <div key={key} className="flex justify-between text-xs py-1">
      <Text className="text-gray-500">{key.replace(/([A-Z])/g, ' $1')}:</Text>
      <Text className="font-semibold">{String(value)}</Text>
    </div>
  ));

  return (
    <NodeStatusIndicator status={status}>
      <NodeTooltip>
        <NodeTooltipTrigger>
          <NodeTooltipContent position={Position.Right} className="bg-slate-500 p-2 rounded shadow-lg max-w-xs">
            {rows.length > 0 ? rows : <Text className="text-xs text-gray-500">Loading details...</Text>}
          </NodeTooltipContent>
          <BaseNode>
            {getHandles(type)}
            <BaseNodeContent className="flex items-center space-x-1">
              <Text className="font-medium">{label}</Text>
              {isLoading && <Loader size="xs" />}
            </BaseNodeContent>
          </BaseNode>
        </NodeTooltipTrigger>
      </NodeTooltip>
    </NodeStatusIndicator>
  );
};

/* eslint-enable @typescript-eslint/no-explicit-any */