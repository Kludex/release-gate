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
  primary: "border-black bg-black text-white hover:bg-yellow hover:text-black",
  danger: "border-black bg-white hover:bg-rose",
  neutral: "border-black bg-white hover:bg-yellow",
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
      class={`inline-flex cursor-pointer items-center gap-2.5 self-start rounded-full border-2 text-left font-semibold leading-tight transition hover:-rotate-2 group-data-[state=busy]/form:busy-stripes group-data-[state=busy]/form:text-black disabled:cursor-wait disabled:hover:rotate-0 motion-reduce:hover:rotate-0 ${
        small ? "px-4 py-1.5 text-base" : "px-6 py-3 text-lg"
      } ${TONES[tone]}`}
    >
      <PasskeyIcon class={`shrink-0 ${small ? "size-4" : "size-5"}`} />
      {label}
    </button>
    <p
      data-output
      role="status"
      class="text-base empty:hidden group-data-[state=error]/form:self-start group-data-[state=error]/form:rounded-2xl group-data-[state=error]/form:bg-rose group-data-[state=error]/form:px-4 group-data-[state=error]/form:py-2"
    />
  </form>
);

export const inputClass =
  "block w-full rounded-none border-0 border-b-2 border-black bg-transparent pb-1.5 text-xl transition-shadow placeholder:text-grey-600 focus:shadow-[0_4px_0_0_var(--color-yellow)]";

type FieldProps = { label: string; children: Child };

export const Field = ({ label, children }: FieldProps) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: the control arrives as `children`.
  <label class="block space-y-2">
    <span class="block text-sm font-semibold uppercase tracking-wide">{label}</span>
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
    <ChevronIcon class="pointer-events-none absolute top-1.5 right-0 size-5" />
  </span>
);

type CheckboxProps = { name: string; checked: boolean; children: Child };

export const Checkbox = ({ name, checked, children }: CheckboxProps) => (
  <label class="flex cursor-pointer items-start gap-3 text-lg">
    <span class="relative mt-0.5 grid size-6 shrink-0 place-items-center">
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        class="peer absolute inset-0 cursor-pointer appearance-none rounded-md border-2 border-black bg-white transition-colors checked:bg-yellow"
      />
      <CheckIcon class="pointer-events-none relative hidden size-4 peer-checked:block" />
    </span>
    <span>{children}</span>
  </label>
);
