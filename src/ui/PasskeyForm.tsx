import type { Child } from "hono/jsx";

type Props = {
  action: string;
  challenge?: string;
  fields?: Record<string, string>;
  label: string;
  tone?: "primary" | "danger" | "neutral";
  children?: Child;
};

const TONES = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
  neutral: "bg-stone-800 text-white hover:bg-stone-900",
};

/** A form submitted by `client/webauthn.ts`, which runs the passkey ceremony around the POST. */
export const PasskeyForm = ({
  action,
  challenge,
  fields,
  label,
  tone = "neutral",
  children,
}: Props) => (
  <form method="post" action={action} data-passkey data-challenge={challenge} class="space-y-3">
    {Object.entries(fields ?? {}).map(([name, value]) => (
      <input type="hidden" name={name} value={value} />
    ))}
    {children}
    <button
      type="submit"
      class={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${TONES[tone]}`}
    >
      {label}
    </button>
    <p data-output class="text-sm text-stone-600" role="status" />
  </form>
);

export const inputClass =
  "block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none";
