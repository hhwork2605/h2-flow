// Tiny inline icon set. 20x20 viewBox, stroke-based, currentColor.
const Icon = ({ d, size = 18, stroke = 1.6, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const Icons = {
  sparkle: <Icon d="M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M15 5l-2 2M7 13l-2 2" />,
  flow: <Icon d={<><path d="M4 6h8" /><path d="M4 10h12" /><path d="M4 14h6" /><circle cx="14" cy="6" r="1.2" /><circle cx="16" cy="14" r="1.2" /></>} />,
  prompt: <Icon d={<><path d="M4 5h12v8H8l-4 3z" /></>} />,
  tasks: <Icon d={<><path d="M4 6h12" /><path d="M4 10h12" /><path d="M4 14h8" /></>} />,
  photo: <Icon d={<><rect x="3" y="4" width="14" height="12" rx="1.5" /><circle cx="7.5" cy="8.5" r="1.2" /><path d="M3 14l4-3 4 3 3-2 3 2" /></>} />,
  snippet: <Icon d={<><path d="M7 5L3 9l4 4" /><path d="M13 5l4 4-4 4" /></>} />,
  history: <Icon d={<><circle cx="10" cy="10" r="6.5" /><path d="M10 6v4l2.5 2" /></>} />,
  log: <Icon d={<><path d="M5 4h7l3 3v9H5z" /><path d="M12 4v3h3" /></>} />,
  chev: <Icon d="M5 8l5 5 5-5" />,
  plus: <Icon d="M10 4v12M4 10h12" />,
  minus: <Icon d="M4 10h12" />,
  search: <Icon d={<><circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" /></>} />,
  upload: <Icon d={<><path d="M10 14V4" /><path d="M6 8l4-4 4 4" /><path d="M4 16h12" /></>} />,
  bookmark: <Icon d="M6 3v14l4-3 4 3V3z" />,
  download: <Icon d={<><path d="M10 4v10" /><path d="M6 10l4 4 4-4" /><path d="M4 16h12" /></>} />,
  bolt: <Icon d="M11 3l-5 8h4l-1 6 5-8h-4l1-6z" />,
  bell: <Icon d={<><path d="M5 14V9a5 5 0 0 1 10 0v5l1 2H4z" /><path d="M8 17a2 2 0 0 0 4 0" /></>} />,
  globe: <Icon d={<><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3a10 10 0 0 1 0 14M10 3a10 10 0 0 0 0 14" /></>} />,
  moon: <Icon d="M15 11A6 6 0 0 1 9 5a6 6 0 1 0 6 6z" fill="currentColor" stroke="none" />,
  sun: <Icon d={<><circle cx="10" cy="10" r="3" fill="currentColor" stroke="none" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4 4l1.5 1.5M14.5 14.5L16 16M4 16l1.5-1.5M14.5 5.5L16 4" /></>} />,
  doc: <Icon d={<><path d="M5 3h7l3 3v11H5z" /><path d="M12 3v3h3" /></>} />,
  user: <Icon d={<><circle cx="10" cy="7" r="3" /><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" /></>} />,
  image: <Icon d={<><rect x="3" y="4" width="14" height="12" rx="1.5" /><circle cx="7.5" cy="8.5" r="1.2" /><path d="M3 14l4-3 4 3 3-2 3 2" /></>} />,
  video: <Icon d={<><rect x="3" y="5" width="10" height="10" rx="1.5" /><path d="M13 9l4-2v6l-4-2z" /></>} />,
  play: <Icon d="M6 4l10 6-10 6z" fill="currentColor" stroke="none" />,
  refresh: <Icon d={<><path d="M4 10a6 6 0 0 1 10-4.2L16 7" /><path d="M16 4v3h-3" /><path d="M16 10a6 6 0 0 1-10 4.2L4 13" /><path d="M4 16v-3h3" /></>} />,
  more: <Icon d={<><circle cx="5" cy="10" r="1" fill="currentColor" /><circle cx="10" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></>} />,
  filter: <Icon d={<><path d="M3 4h14l-5 7v5l-4-2v-3z" /></>} />,
  attach: <Icon d="M14 7l-6 6a3 3 0 1 0 4 4l7-7a5 5 0 1 0-7-7l-7 7" />,
  folder: <Icon d={<><path d="M3 6a1 1 0 0 1 1-1h3l1.5 1.5H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></>} />,
  layers: <Icon d={<><path d="M10 3l7 4-7 4-7-4z" /><path d="M3 11l7 4 7-4" /></>} />,
  crown: <Icon d={<><path d="M4 14l-1-7 4 3 3-5 3 5 4-3-1 7z" /><path d="M4 14h12" /></>} />,
  wand: <Icon d={<><path d="M5 15l8-8" /><path d="M12 4l1 1M15 7l1 1M14 4l-.5 1.5L12 6l1.5.5L14 8l.5-1.5L16 6l-1.5-.5z" /></>} />,
  style: <Icon d={<><circle cx="10" cy="10" r="6.5" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="11.5" r="1" fill="currentColor" stroke="none" /></>} />,
  check: <Icon d="M4 10l4 4 8-9" />,
};

window.Icon = Icon;
window.Icons = Icons;
