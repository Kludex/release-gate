const SHACKLE = "M110 175V120a60 60 0 0 1 120 0v55";
const SPIKES =
  "M62 186L28 202L62 218ZM62 248L28 264L62 280ZM278 186L312 202L278 218ZM278 248L312 264L278 280Z";

/** A die-cut sticker of a spiked padlock that growls at anyone without a passkey. */
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
        <path d={`${SHACKLE}Z`} />
        <rect x="60" y="160" width="220" height="150" rx="32" />
        <path d={SPIKES} />
      </g>
    </defs>
    <use
      href="#padlock-outline"
      class="fill-grey-200 stroke-grey-200"
      stroke-width="36"
      transform="translate(6 9)"
    />
    <use href="#padlock-outline" class="fill-white stroke-white" stroke-width="36" />
    <path d={SHACKLE} fill="none" stroke-width="34" />
    <path d={SHACKLE} fill="none" class="stroke-grey-600" stroke-width="18" />
    <path d={SPIKES} class="fill-black" stroke-width="6" />
    <rect x="60" y="160" width="220" height="150" rx="32" class="fill-black" stroke-width="6" />
    <path d="M94 204L160 230Q152 254 124 252Q98 248 94 204Z" class="fill-yellow" stroke="none" />
    <path d="M246 204L180 230Q188 254 216 252Q242 248 246 204Z" class="fill-yellow" stroke="none" />
    <ellipse cx="130" cy="238" rx="3.5" ry="11" class="fill-black" stroke="none" />
    <ellipse cx="210" cy="238" rx="3.5" ry="11" class="fill-black" stroke="none" />
    <path
      d="M92 262H248L236 274L220 306L206 274L192 292L181 274L170 292L159 274L148 292L134 274L120 306L104 274Z"
      class="fill-white"
      stroke-width="4"
    />
    <path d="M36 128l18 12M24 156l22 4M304 128l-18 12M316 156l-22 4" fill="none" stroke-width="7" />
  </svg>
);
