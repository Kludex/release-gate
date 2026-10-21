import type { Child } from "hono/jsx";
import { CheckIcon, ChevronIcon, PasskeyIcon } from "@/ui/Icons";

type Tone = "primary" | "danger" | "neutral";

type Props = {
  action: string;
  challenge?: string;
  fields?: Record<string, string>;
  label: string;
  tone?: Tone;
  small?: boolean;
  children?: Child;
};

const TONES: Record<Tone, string> = {
  primary: "bg-coral hover:bg-green",
  danger: "bg-milk hover:bg-red",
  neutral: "bg-milk hover:bg-green",
};

/**
 * A form submitted by `client/webauthn.ts`, which runs the passkey ceremony around the POST and
 * sets `data-state` to `busy`, `done` or `error`.
 */
export const PasskeyForm = ({
  action,
  challenge,
  fields,
  label,
  tone = "neutral",
  small = false,
  children,
}: Props) => (
  <form
    method="post"
    action={action}
    data-passkey
    data-challenge={challenge}
    class="group/form flex flex-col gap-6"
  >
    {Object.entries(fields ?? {}).map(([name, value]) => (
      <input type="hidden" name={name} value={value} />
    ))}
    {children}
    <button
      type="submit"
      class={`inline-flex cursor-pointer items-center gap-3 self-start border-3 text-left border-black font-bold uppercase leading-none transition-colors group-data-[state=busy]/form:busy-stripes disabled:cursor-wait ${
        small ? "px-4 py-2.5 text-sm" : "px-7 py-4 text-base lg:px-9 lg:py-5 lg:text-lg"
      } ${TONES[tone]}`}
    >
      <PasskeyIcon class={`shrink-0 ${small ? "size-4" : "size-6"}`} />
      {label}
    </button>
    <p
      data-output
      role="status"
      class="text-base font-medium empty:hidden group-data-[state=error]/form:border-3 group-data-[state=error]/form:border-red group-data-[state=error]/form:bg-red/15 group-data-[state=error]/form:px-4 group-data-[state=error]/form:py-3"
    />
  </form>
);

export const inputClass =
  "block w-full rounded-none border-0 border-b-3 border-black bg-transparent pb-2 text-xl font-medium outline-none transition-colors placeholder:font-normal placeholder:text-grey-700 focus:border-purple focus-visible:outline-none";

type FieldProps = { label: string; children: Child };

export const Field = ({ label, children }: FieldProps) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: the control arrives as `children`.
  <label class="block space-y-2">
    <span class="block text-sm font-bold uppercase">{label}</span>
    {children}
  </label>
);

export const Select = ({ name, options }: { name: string; options: string[] }) => (
  <span class="relative block">
    <select name={name} class={`${inputClass} cursor-pointer appearance-none pr-8`}>
      {options.map((option) => (
        <option value={option}>{option}</option>
      ))}
    </select>
    <ChevronIcon class="pointer-events-none absolute top-1 right-0 size-5" />
  </span>
);

type CheckboxProps = { name: string; checked: boolean; children: Child };

export const Checkbox = ({ name, checked, children }: CheckboxProps) => (
  <label class="flex cursor-pointer items-start gap-4 text-lg">
    <span class="relative mt-0.5 grid size-7 shrink-0 place-items-center">
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        class="peer absolute inset-0 cursor-pointer appearance-none border-3 border-black bg-milk transition-colors checked:bg-green"
      />
      <CheckIcon class="pointer-events-none relative hidden size-5 peer-checked:block" />
    </span>
    <span>{children}</span>
  </label>
);
