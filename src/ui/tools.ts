import type { Tool } from '../state/uiStore';

export interface ToolInfo {
  id: Tool;
  label: string;
  key: string;
  hint: string;
}

export const TOOL_GROUPS: Array<{ label: string; tools: ToolInfo[] }> = [
  {
    label: 'Shape',
    tools: [
      { id: 'select', label: 'Select & move', key: 'V', hint: 'Drag points, select zones. Double-click the outline to add a point.' },
      { id: 'pen', label: 'Freehand outline', key: 'P', hint: 'Draw a closed loop; it is fitted to an editable spline.' },
      { id: 'insert', label: 'Add point', key: 'I', hint: 'Click the outline to insert a control point.' },
      { id: 'remove', label: 'Remove point', key: 'X', hint: 'Click a control point to delete it.' },
    ],
  },
  {
    label: 'Zones',
    tools: [
      { id: 'beach', label: 'Beach entry', key: 'B', hint: 'Drag along the waterline to set the beach span.' },
      { id: 'bench', label: 'Bench', key: 'N', hint: 'Drag along the waterline to place a bench.' },
      { id: 'shelf', label: 'Sun shelf', key: 'S', hint: 'Lasso the shelf area.' },
      { id: 'deep', label: 'Deep zone', key: 'D', hint: 'Lasso the deep area.' },
    ],
  },
  {
    label: 'Features',
    tools: [{ id: 'rock', label: 'Rockwork', key: 'K', hint: 'Click points along a rock wall, waterfall or grotto; double-click or Enter to finish.' }],
  },
  {
    label: 'Sculpt',
    tools: [
      { id: 'deepen', label: 'Deepen', key: 'E', hint: 'Paint to dig the floor deeper. Works in plan and 3D.' },
      { id: 'raise', label: 'Raise', key: 'R', hint: 'Paint to build the floor up.' },
      { id: 'smooth', label: 'Smooth', key: 'M', hint: 'Paint to soften bumps and creases.' },
      { id: 'flatten', label: 'Flatten to depth', key: 'F', hint: 'Paint toward the target depth. Alt-click to sample a depth.' },
    ],
  },
  {
    label: 'View',
    tools: [{ id: 'pan', label: 'Pan', key: 'H', hint: 'Drag to pan. Hold Space with any tool. Scroll to zoom.' }],
  },
];

export const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
export const toolByKey = (key: string) => ALL_TOOLS.find((t) => t.key.toLowerCase() === key.toLowerCase());
