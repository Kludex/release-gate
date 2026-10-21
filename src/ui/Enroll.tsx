import { Card } from "@/ui/Layout";
import { inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { action: string; title: string; help: string };

export const Enroll = ({ action, title, help }: Props) => (
  <Card>
    <div class="space-y-4">
      <h1 class="text-lg font-semibold">{title}</h1>
      <p class="text-sm text-stone-600">{help}</p>
      <PasskeyForm action={action} label="Register passkey">
        <label class="block space-y-1 text-sm">
          <span>Code</span>
          <input name="code" required autocomplete="off" class={`${inputClass} font-mono`} />
        </label>
        <label class="block space-y-1 text-sm">
          <span>Passkey name</span>
          <input
            name="name"
            required
            maxlength={64}
            class={inputClass}
            placeholder="MacBook Touch ID"
          />
        </label>
      </PasskeyForm>
    </div>
  </Card>
);
