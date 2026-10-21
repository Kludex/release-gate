type Props = { class: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2.5",
  "stroke-linecap": "square",
} as const;

export const ArrowIcon = ({ class: className }: Props) => (
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true" {...stroke}>
    <path d="M3 12h17M13 5l7 7-7 7" />
  </svg>
);

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

/** The patrick.wtf highlighter: a hand-cut blob behind a word. */
export const Blob = () => (
  <svg
    viewBox="-80 -80 160 160"
    preserveAspectRatio="none"
    class="absolute -inset-x-[6%] -inset-y-[2%] -z-10 h-[104%] w-[112%] fill-yellow/70"
    aria-hidden="true"
  >
    <path d="M47 -61C61 -50 70 -34 73 -17C76 0 73 18 64 33C55 48 40 60 23 66C6 72 -13 73 -30 66C-47 59 -62 45 -69 27C-76 9 -75 -11 -67 -28C-59 -45 -44 -58 -27 -66C-10 -74 9 -77 24 -74C39 -71 33 -72 47 -61Z" />
  </svg>
);
