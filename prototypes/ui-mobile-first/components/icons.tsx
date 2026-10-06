import type { SVGProps } from "react";

const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" } as const;
type P = SVGProps<SVGSVGElement> & { size?: number };
const make = (d: React.ReactNode) =>
  function Icon({ size = 20, ...rest }: P) {
    return (
      <svg width={size} height={size} aria-hidden="true" {...base} {...rest}>
        {d}
      </svg>
    );
  };

export const IconHome = make(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />);
export const IconGrid = make(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const IconMic = make(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>);
export const IconCheck = make(<path d="M20 6L9 17l-5-5" />);
export const IconAlert = make(<><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>);
export const IconList = make(<path d="M4 6h16M4 12h10M4 18h6" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconChevron = make(<path d="M9 6l6 6-6 6" />);
export const IconBack = make(<path d="M15 6l-6 6 6 6" />);
export const IconUp = make(<path d="M6 15l6-6 6 6" />);
export const IconDown = make(<path d="M6 9l6 6 6-6" />);
export const IconEdit = make(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />);
export const IconSend = make(<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />);
