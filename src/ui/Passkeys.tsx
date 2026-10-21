import type { Credential } from "@/db/credentials";
import { Card, formatTime, Section } from "@/ui/Layout";
import { inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { credentials: Credential[] };

export const Passkeys = ({ credentials }: Props) => (
  <>
    <Section title="Your passkeys">
      {credentials.length === 0 ? (
        <Card>
          <p class="text-sm">
            You have no passkeys yet. Your first one needs an{" "}
            <a href="/invite" class="underline">
              invite code
            </a>{" "}
            or the{" "}
            <a href="/bootstrap" class="underline">
              bootstrap code
            </a>
            .
          </p>
        </Card>
      ) : (
        <ul class="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
          {credentials.map((credential) => (
            <li class="flex gap-3 px-4 py-3">
              <span class="font-medium">{credential.name}</span>
              <span class="text-stone-500">added {formatTime(credential.created_at)}</span>
              <span class="ml-auto text-stone-500">
                {credential.last_used_at
                  ? `used ${formatTime(credential.last_used_at)}`
                  : "never used"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
    {credentials.length > 0 && (
      <Section title="Add a passkey">
        <Card>
          <PasskeyForm
            action="/passkeys/register/options"
            challenge="/passkeys/challenge"
            label="Confirm with an existing passkey, then add"
          >
            <label class="block space-y-1 text-sm">
              <span>Name</span>
              <input
                name="name"
                required
                maxlength={64}
                class={inputClass}
                placeholder="YubiKey 5C"
              />
            </label>
          </PasskeyForm>
        </Card>
      </Section>
    )}
  </>
);
