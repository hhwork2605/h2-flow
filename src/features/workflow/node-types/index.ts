/**
 * NodeTemplates — registry cho 14 node kinds.
 *
 * Layer: Feature
 * Owner: features/workflow/node-types
 *
 * Tham chiếu: `reference-ext/src/workflow/NodeTemplates.js` (port type matrix
 * + accent colors) + `docs/features/04-workflow.md §C`.
 *
 * Khi thêm node kind mới:
 *   1. Bổ sung vào `NodeKind` union trong `src/types/workflow.types.ts`.
 *   2. Thêm entry vào `NODE_TEMPLATES` dưới.
 *   3. (optional) Đăng ký executor trong WorkflowExecutor.
 */

import type { NodeKind, NodeTemplate } from '@/types/workflow.types';

export const NODE_TEMPLATES: Record<NodeKind, NodeTemplate> = {
  /* ──────────── Triggers / inputs ──────────── */

  trigger: {
    kind: 'trigger',
    label: 'Trigger',
    description: 'Điểm bắt đầu workflow',
    accent: '#71717a',
    iconName: 'Play',
    inputs: [],
    outputs: [{ id: 'out', type: 'any', label: 'Output' }],
    defaultParams: {
      source: 'manual', // 'manual' | 'telegram' | 'schedule'
    },
  },

  prompt: {
    kind: 'prompt',
    label: 'Prompt',
    description: 'Văn bản prompt (single hoặc multi-line)',
    accent: '#9177e1',
    iconName: 'MessageSquareText',
    inputs: [],
    outputs: [{ id: 'text-out', type: 'text', label: 'Văn bản' }],
    defaultParams: {
      text: '',
      multi_prompt: false,
    },
  },

  /* ──────────── Compute / branching ──────────── */

  branch: {
    kind: 'branch',
    label: 'Branch',
    description: 'Rẽ nhánh điều kiện true/false',
    accent: '#71717a',
    iconName: 'GitBranch',
    inputs: [{ id: 'in', type: 'any', label: 'Input' }],
    outputs: [
      { id: 'true', type: 'any', label: 'Khi đúng' },
      { id: 'false', type: 'any', label: 'Khi sai' },
    ],
    defaultParams: {
      // Expression sandbox-eval (vd: "count(input) > 5")
      expression: '',
    },
  },

  delay: {
    kind: 'delay',
    label: 'Delay',
    description: 'Tạm dừng theo ms',
    accent: '#71717a',
    iconName: 'Timer',
    inputs: [{ id: 'in', type: 'any', label: 'Input' }],
    outputs: [{ id: 'out', type: 'any', label: 'Output' }],
    defaultParams: {
      duration_ms: 3000,
    },
  },

  /* ──────────── Image / video generation ──────────── */

  generate: {
    kind: 'generate',
    label: 'Generate',
    description: 'Tạo ảnh/video qua provider',
    accent: '#9177e1',
    iconName: 'Sparkles',
    inputs: [
      { id: 'prompt-in', type: 'text', label: 'Prompt' },
      { id: 'ref-in', type: 'image', label: 'Reference', multiple: true },
    ],
    outputs: [{ id: 'image-out', type: 'image', label: 'Ảnh' }],
    defaultParams: {
      provider: 'flow',
      media_type: 'image',
      model: '',
      ratio: '16:9',
      quantity: 4,
      prompt_input: 'connected',
    },
  },

  chatgpt: {
    kind: 'chatgpt',
    label: 'ChatGPT',
    description: 'Generate / enhance qua ChatGPT',
    accent: '#10a37f',
    iconName: 'Bot',
    inputs: [{ id: 'prompt-in', type: 'text', label: 'Prompt' }],
    outputs: [
      { id: 'text-out', type: 'text', label: 'Văn bản' },
      { id: 'image-out', type: 'image', label: 'Ảnh' },
    ],
    defaultParams: {
      model: 'gpt-4o',
      mode: 'image', // 'image' | 'text'
    },
  },

  grok: {
    kind: 'grok',
    label: 'Grok',
    description: 'Generate ảnh/video qua Grok',
    accent: '#1d9bf0',
    iconName: 'Bot',
    inputs: [{ id: 'prompt-in', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'image-out', type: 'image', label: 'Output' }],
    defaultParams: {
      model: 'grok-image-2',
      mode: 'image', // 'image' | 'video'
      ratio: '16:9',
    },
  },

  gemini: {
    kind: 'gemini',
    label: 'Gemini',
    description: 'Generate qua Gemini Imagen',
    accent: '#a259ff',
    iconName: 'Bot',
    inputs: [{ id: 'prompt-in', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'image-out', type: 'image', label: 'Ảnh' }],
    defaultParams: {
      model: 'gemini-imagen',
      ratio: '16:9',
    },
  },

  /* ──────────── Image editing ──────────── */

  edit: {
    kind: 'edit',
    label: 'Edit',
    description: 'Inpaint / outpaint / variations',
    accent: '#9177e1',
    iconName: 'Wand2',
    inputs: [
      { id: 'image-in', type: 'image', label: 'Ảnh nguồn' },
      { id: 'prompt-in', type: 'text', label: 'Instruction' },
    ],
    outputs: [{ id: 'image-out', type: 'image', label: 'Ảnh đã sửa' }],
    defaultParams: {
      strength: 0.7,
      mode: 'inpaint', // 'inpaint' | 'outpaint' | 'variation'
    },
  },

  angles: {
    kind: 'angles',
    label: 'Angles',
    description: 'Sinh nhiều góc camera của ảnh',
    accent: '#9177e1',
    iconName: 'Camera',
    inputs: [{ id: 'image-in', type: 'image', label: 'Ảnh nguồn' }],
    outputs: [{ id: 'images-out', type: 'image', label: 'Ảnh các góc' }],
    defaultParams: {
      preset: 'portrait-reangle',
      angle_count: 3,
    },
  },

  effects: {
    kind: 'effects',
    label: 'Effects',
    description: 'Áp filter / color grade / vintage',
    accent: '#9177e1',
    iconName: 'Palette',
    inputs: [{ id: 'image-in', type: 'image', label: 'Ảnh nguồn' }],
    outputs: [{ id: 'image-out', type: 'image', label: 'Ảnh sau effect' }],
    defaultParams: {
      effect_id: '',
      intensity: 50,
    },
  },

  /* ──────────── Output / I/O ──────────── */

  download: {
    kind: 'download',
    label: 'Download',
    description: 'Tải xuống thư mục local',
    accent: '#3b82f6',
    iconName: 'Download',
    inputs: [{ id: 'image-in', type: 'image', label: 'Ảnh', multiple: true }],
    outputs: [{ id: 'status-out', type: 'any', label: 'Status' }],
    defaultParams: {
      folder_template: '{date}/{project}',
      filename_template: '{prompt_short}_{idx}',
      resolution: '2K',
    },
  },

  telegram: {
    kind: 'telegram',
    label: 'Telegram',
    description: 'Gửi ảnh + caption qua Telegram bot',
    accent: '#26A5E4',
    iconName: 'Send',
    inputs: [
      { id: 'image-in', type: 'image', label: 'Ảnh', multiple: true },
      { id: 'text-in', type: 'text', label: 'Caption' },
    ],
    outputs: [{ id: 'status-out', type: 'any', label: 'Status' }],
    defaultParams: {
      mode: 'photo', // 'photo' | 'document'
    },
  },

  /* ──────────── Composite ──────────── */

  multi: {
    kind: 'multi',
    label: 'Multi-Task',
    description: 'Chạy batch nhiều prompts song song',
    accent: '#9177e1',
    iconName: 'ListChecks',
    inputs: [{ id: 'prompts-in', type: 'text', label: 'Danh sách prompts' }],
    outputs: [{ id: 'images-out', type: 'image', label: 'Ảnh đầu ra' }],
    defaultParams: {
      run_mode: 'parallel', // 'sequential' | 'parallel'
      max_parallel: 4,
    },
  },
};

/** Convenience array — dùng cho render palette grid. */
export const NODE_TEMPLATE_LIST: NodeTemplate[] = Object.values(NODE_TEMPLATES);

/** Nhóm logic palette (cho UI gom theo category). */
export const NODE_TEMPLATE_GROUPS: { id: string; label: string; kinds: NodeKind[] }[] = [
  { id: 'flow', label: 'Bắt đầu', kinds: ['trigger', 'prompt'] },
  { id: 'gen', label: 'Tạo nội dung', kinds: ['generate', 'chatgpt', 'grok', 'gemini'] },
  { id: 'edit', label: 'Chỉnh sửa', kinds: ['edit', 'angles', 'effects'] },
  { id: 'logic', label: 'Logic', kinds: ['branch', 'delay', 'multi'] },
  { id: 'output', label: 'Output', kinds: ['download', 'telegram'] },
];

export function getTemplate(kind: NodeKind): NodeTemplate {
  return NODE_TEMPLATES[kind];
}
