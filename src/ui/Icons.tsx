type Props = { class: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2.5",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

export const PasskeyIcon = ({ class: className }: Props) => (
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true" {...stroke}>
    <circle cx="8" cy="7" r="4" />
    <path d="M1.5 21v-2.5A4.5 4.5 0 0 1 6 14h4" />
    <circle cx="17" cy="11" r="3" />
    <path d="M17 14v8M17 18h3" />
  </svg>
);

export const CheckIcon = ({ class: className }: Props) => (
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true" {...stroke} stroke-width="3.5">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const ChevronIcon = ({ class: className }: Props) => (
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true" {...stroke} stroke-width="3">
    <path d="M5 9l7 7 7-7" />
  </svg>
);

export const GitHubIcon = ({ class: className }: Props) => (
  <svg viewBox="0 0 16 16" class={className} fill="currentColor" aria-hidden="true">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>
);

/** The patrick.wtf highlighter: a lumpy yellow blob, positioned by `class`. */
export const Blob = ({ class: className }: Props) => (
  <svg
    viewBox="-80 -80 160 160"
    preserveAspectRatio="none"
    class={`absolute -z-10 fill-yellow ${className}`}
    aria-hidden="true"
  >
    <path d="M-14 -74C26 -80 68 -66 78 -30C88 6 76 48 44 66C12 84 -36 80 -60 56C-84 32 -82 -10 -70 -38C-58 -66 -42 -70 -14 -74Z" />
  </svg>
);
