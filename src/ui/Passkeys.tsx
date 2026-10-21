import type { Credential } from "@/db/credentials";
import { PasskeyIcon } from "@/ui/Icons";
import { Card, Empty, formatTime, link, PageTitle, rows, Section } from "@/ui/Layout";
import { Field, inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { credentials: Credential[] };

export const Passkeys = ({ credentials }: Props) => (
  <>
    <PageTitle
      title="Passkeys"
      subtitle="Every passkey here can approve releases for you. Keep at least two, on different devices."
    />
    <Section title="Your passkeys">
      {credentials.length === 0 ? (
        <Empty>
          You have no passkeys yet. Your first one needs an{" "}
          <a href="/invite" class={link}>
            invite code
          </a>{" "}
          or the{" "}
          <a href="/bootstrap" class={link}>
            bootstrap code
          </a>
          .
        </Empty>
      ) : (
        <ul class={rows}>
          {credentials.map((credential) => (
            <li class="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4">
              <PasskeyIcon class="size-7" />
              <span class="text-xl font-bold">{credential.name}</span>
              <span class="text-base text-grey-700 sm:ml-auto">
                added <time>{formatTime(credential.created_at)}</time>
                {" · "}
                {credential.last_used_at ? (
                  <>
                    used <time>{formatTime(credential.last_used_at)}</time>
                  </>
                ) : (
                  "never used"
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
    {credentials.length > 0 && (
      <Section title="Add a passkey" tone="caramel">
        <Card>
          <PasskeyForm
            action="/passkeys/register/options"
            challenge="/passkeys/challenge"
            label="Confirm with an existing passkey, then add"
          >
            <Field label="Name">
              <input
                name="name"
                required
                maxlength={64}
                class={`${inputClass} max-w-md`}
                placeholder="YubiKey 5C"
              />
            </Field>
          </PasskeyForm>
        </Card>
      </Section>
    )}
  </>
);
