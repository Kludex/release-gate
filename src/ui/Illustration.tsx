const Sparkle = ({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) => (
  <path
    transform={`translate(${x} ${y}) scale(${size / 20})`}
    d="M0 -20C2 -6 6 -2 20 0C6 2 2 6 0 20C-2 6 -6 2 -20 0C-6 -2 -2 -6 0 -20Z"
    class={fill}
    stroke-width={(4 * 20) / size}
  />
);

/** A die-cut sticker of a happy padlock. */
export const Padlock = ({ class: className }: { class: string }) => (
  <svg
    viewBox="0 0 340 340"
    class={className}
    stroke="#000"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <defs>
      <g id="padlock-outline">
        <path d="M110 175V120a60 60 0 0 1 120 0v55Z" />
        <rect x="60" y="160" width="220" height="150" rx="40" />
      </g>
    </defs>
    <use
      href="#padlock-outline"
      class="fill-grey-200 stroke-grey-200"
      stroke-width="36"
      transform="translate(6 9)"
    />
    <use href="#padlock-outline" class="fill-white stroke-white" stroke-width="36" />
    <path d="M110 175V120a60 60 0 0 1 120 0v55" fill="none" stroke-width="34" />
    <path
      d="M110 175V120a60 60 0 0 1 120 0v55"
      fill="none"
      class="stroke-white"
      stroke-width="20"
    />
    <rect x="60" y="160" width="220" height="150" rx="40" class="fill-yellow" stroke-width="7" />
    <circle cx="132" cy="226" r="10" class="fill-black" stroke="none" />
    <circle cx="208" cy="226" r="10" class="fill-black" stroke="none" />
    <circle cx="135" cy="222" r="3.5" class="fill-white" stroke="none" />
    <circle cx="211" cy="222" r="3.5" class="fill-white" stroke="none" />
    <ellipse cx="108" cy="254" rx="15" ry="9" class="fill-pink" stroke="none" />
    <ellipse cx="232" cy="254" rx="15" ry="9" class="fill-pink" stroke="none" />
    <path d="M156 252q14 14 28 0" fill="none" stroke-width="7" />
    <Sparkle x={292} y={70} size={24} fill="fill-yellow" />
    <Sparkle x={300} y={136} size={12} fill="fill-pink" />
    <Sparkle x={34} y={110} size={18} fill="fill-yellow" />
    <Sparkle x={52} y={60} size={10} fill="fill-pink" />
  </svg>
);
