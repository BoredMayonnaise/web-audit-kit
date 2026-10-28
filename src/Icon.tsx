const paths: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  project:
    "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z M8 3v5h13 M7 12h10 M7 16h7",
  brand:
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1-2.7H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z M7 10h.01 M10 7h.01 M15 7h.01 M18 10h.01",
  findings: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  plan: "M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2z M7 3v6h10V3 M7 21v-8h10v8",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v4h16v-4",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4",
  folder:
    "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  back: "M19 12H5 M11 6l-6 6 6 6",
  up: "M12 19V5 M6 11l6-6 6 6",
  down: "M12 5v14 M6 13l6 6 6-6",
  check: "M5 12l4 4L19 6",
  shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
  help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  copy: "M9 9h11v12H9z M5 15H3V3h12v2",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  image: "M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M16 7h.01",
  close: "M6 6l12 12 M6 18L18 6",
  info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  chevron: "M9 5l7 7-7 7",
  leaf: "M20 3c-9 0-16 3-16 10a7 7 0 0 0 7 7c7 0 9-8 9-17z M4 21l11-12",
  print: "M6 9V3h12v6 M6 17H3V9h18v8h-3 M6 14h12v7H6z M17 11h.01",
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.project} />
    </svg>
  );
}
