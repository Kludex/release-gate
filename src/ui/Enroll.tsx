import { Card, PageTitle, Section } from "@/ui/Layout";
import { Field, inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { action: string; title: string; help: string };

export const Enroll = ({ action, title, help }: Props) => (
  <>
    <PageTitle title={title} subtitle={help} />
    <Section title="Register your passkey" tone="caramel">
      <Card>
        <PasskeyForm action={action} label="Register passkey" tone="primary">
          <div class="grid gap-8 md:grid-cols-2">
            <Field label="Code">
              <input name="code" required autocomplete="off" class={`${inputClass} font-mono`} />
            </Field>
            <Field label="Passkey name">
              <input
                name="name"
                required
                maxlength={64}
                class={inputClass}
                placeholder="MacBook Touch ID"
              />
            </Field>
          </div>
        </PasskeyForm>
      </Card>
    </Section>
  </>
);
