const Sparkle = ({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) => (
  <path
    transform={`translate(${x} ${y}) scale(${size / 20})`}
    d="M0 -20C2 -6 6 -2 20 0C6 2 2 6 0 20C-2 6 -6 2 -20 0C-6 -2 -2 -6 0 -20Z"
    class={fill}
  />
);

/** A padlock waiting for its key, drawn in the Python Italia line style. */
export const Padlock = ({ class: className }: { class: string }) => (
  <svg
    viewBox="0 0 340 360"
    class={className}
    stroke="#0e1116"
    stroke-width="4"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <Sparkle x={292} y={52} size={22} fill="fill-yellow" />
    <Sparkle x={36} y={34} size={12} fill="fill-cream" />
    <Sparkle x={312} y={150} size={11} fill="fill-pink" />
    <Sparkle x={24} y={262} size={14} fill="fill-cream" />
    <path class="fill-cream" d="M98 182V126a72 72 0 0 1 144 0v56h-34v-56a38 38 0 0 0-76 0v56Z" />
    <rect class="fill-coral" x="56" y="170" width="228" height="164" rx="14" />
    <path class="fill-caramel" d="M56 184a14 14 0 0 1 14-14h200a14 14 0 0 1 14 14v18H56Z" />
    <circle class="fill-cream" cx="82" cy="226" r="7" />
    <circle class="fill-cream" cx="258" cy="226" r="7" />
    <circle class="fill-cream" cx="82" cy="306" r="7" />
    <circle class="fill-cream" cx="258" cy="306" r="7" />
    <path class="fill-black" d="M162 262h16l6 44h-28Z" />
    <circle class="fill-black" cx="170" cy="252" r="20" />
    <g transform="rotate(38 52 110)">
      <circle class="fill-yellow" cx="52" cy="110" r="24" />
      <circle class="fill-milk" cx="52" cy="110" r="8" />
      <path class="fill-yellow" d="M76 102h66v16h-10v14h-14v-14h-8v10h-14v-10h-20Z" />
    </g>
  </svg>
);
