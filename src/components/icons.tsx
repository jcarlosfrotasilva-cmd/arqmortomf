import type { ReactNode } from "react";
import { cx } from "@/lib/client/api";

type IconProps = { className?: string };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSearch = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m16.5 16.5 4.5 4.5" />
  </Svg>
);

export const IconArchive = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 7h18" />
    <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
    <path d="M9 12h6" />
    <path d="M4 3h16v4H4z" />
  </Svg>
);

export const IconUpload = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
  </Svg>
);

export const IconDownload = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 4v12" />
    <path d="m8 12 4 4 4-4" />
    <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
  </Svg>
);

export const IconEdit = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
    <path d="m13.5 7.5 3 3" />
  </Svg>
);

export const IconTrash = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h16" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" />
  </Svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const IconClose = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </Svg>
);

export const IconUsers = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18 14.5c2 .8 3 2.6 3 5.5" />
  </Svg>
);

export const IconBox = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="M4 8.5 12 13l8-4.5" />
    <path d="M12 13v7" />
  </Svg>
);

export const IconCalendar = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3.5V6" />
    <path d="M16 3.5V6" />
  </Svg>
);

export const IconHistory = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4" />
    <path d="M3.5 4.5V9H8" />
    <path d="M12 8v4.5l3 1.8" />
  </Svg>
);

export const IconFile = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </Svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
    <path d="M12 10v4" />
    <path d="M12 17.2h.01" />
  </Svg>
);

export const IconChevronLeft = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m14 6-6 6 6 6" />
  </Svg>
);

export const IconChevronRight = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m10 6 6 6-6 6" />
  </Svg>
);

export const IconMenu = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Svg>
);

export const IconSpinner = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    className={cx("h-5 w-5 shrink-0 animate-spin", className)}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" fill="none" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const IconShield = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.5 5 6.2v5.1c0 4.2 2.8 7.6 7 9.2 4.2-1.6 7-5 7-9.2V6.2L12 3.5Z" />
    <path d="m9 12.2 2.1 2.1L15.2 10" />
  </Svg>
);

export const IconRestore = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V9H8" />
    <path d="m7.8 15.4 6.6-3.4-6.6-3.4v6.8Z" />
  </Svg>
);

export const IconPrinter = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7 9V3.5h10V9" />
    <path d="M5 9h14a2 2 0 0 1 2 2v6h-4v3.5H7V17H3v-6a2 2 0 0 1 2-2Z" />
    <path d="M7 13.5h10" />
  </Svg>
);

export const IconCopy = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
  </Svg>
);

export const IconEye = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12S18 17.5 12 17.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
