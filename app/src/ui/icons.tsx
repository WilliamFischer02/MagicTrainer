import type { SVGProps } from "react";

/** Fluent-style line icons, 20px grid, stroke = currentColor. */
type P = SVGProps<SVGSVGElement>;

function Base({ children, ...rest }: P) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const DeckIcon = (p: P) => (
  <Base {...p}>
    <rect x="5.5" y="3.5" width="9" height="13" rx="1.5" />
    <path d="M3.5 6.5v9a2 2 0 0 0 2 2h7" />
    <path d="M8 7h4M8 10h4" />
  </Base>
);

export const CollectionIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="11" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="11" width="6" height="6" rx="1" />
    <rect x="11" y="11" width="6" height="6" rx="1" />
  </Base>
);

export const RulesIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5z" />
    <path d="M4 16.5A1.5 1.5 0 0 0 5.5 18H16v-3" />
    <path d="M7.5 7h5M7.5 10h5" />
  </Base>
);

export const SettingsIcon = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="2.5" />
    <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M5.1 14.9l1.4-1.4M13.5 6.5l1.4-1.4" />
  </Base>
);

export const BuilderIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 16l6-6" />
    <path d="M9 5l6 6-3 3-6-6z" />
    <path d="M12.5 3.5l4 4" />
  </Base>
);

export const TrainerIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 4.5v11l9-5.5z" />
  </Base>
);

export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="9" r="5" />
    <path d="M13 13l4 4" />
  </Base>
);

export const DownloadIcon = (p: P) => (
  <Base {...p}>
    <path d="M10 3v9M6.5 8.5L10 12l3.5-3.5" />
    <path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
  </Base>
);

export const FolderIcon = (p: P) => (
  <Base {...p}>
    <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H8l2 2h5.5A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" />
  </Base>
);

export const CheckIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 10.5l3.5 3.5L16 6" />
  </Base>
);

export const AlertIcon = (p: P) => (
  <Base {...p}>
    <path d="M10 3l7.5 13h-15z" />
    <path d="M10 8v4M10 14.2v.3" />
  </Base>
);

export const CopyIcon = (p: P) => (
  <Base {...p}>
    <rect x="7" y="7" width="9" height="10" rx="1.5" />
    <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-6A1.5 1.5 0 0 0 4 4.5v8A1.5 1.5 0 0 0 5.5 14H7" />
  </Base>
);

export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Base>
);

export const DatabaseIcon = (p: P) => (
  <Base {...p}>
    <ellipse cx="10" cy="5" rx="6" ry="2.5" />
    <path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5" />
    <path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
  </Base>
);

/** Brand mark: a three-point "planar" sigil in gold. */
export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 6h12M8.5 9v5M11.5 9v5M5.5 6l.8 10.2a1 1 0 0 0 1 .8h5.4a1 1 0 0 0 1-.8L14.5 6M8 6V4h4v2" />
  </Base>
);
export const Sigil = (p: P) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" {...p}>
    <path d="M14 2.5l11 19.5H3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M14 9l5.5 9.5h-11z" fill="currentColor" opacity="0.9" />
    <circle cx="14" cy="15.5" r="1.6" fill="var(--felt)" />
  </svg>
);
