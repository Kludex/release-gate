import { PageTitle, Section } from "@/ui/Layout";
import { Field, inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { action: string; title: string; help: string; askCode?: boolean };

export const Enroll = ({ action, title, help, askCode = false }: Props) => (
  <>
    <PageTitle title={title} subtitle={help} />
    <Section title="Register your passkey">
      <PasskeyForm action={action} label="Register passkey" tone="primary">
        <div class="grid gap-8 md:grid-cols-2">
          {askCode && (
            <Field label="Code">
              <input name="code" required autocomplete="off" class={`${inputClass} font-mono`} />
            </Field>
          )}
          <Field label="Passkey name (optional)">
            <input
              name="name"
              maxlength={64}
              class={inputClass}
              placeholder="Detected from your device"
            />
          </Field>
        </div>
      </PasskeyForm>
    </Section>
  </>
);
