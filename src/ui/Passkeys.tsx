import type { Credential } from "@/db/credentials";
import { PasskeyIcon } from "@/ui/Icons";
import { Empty, formatTime, link, meta, PageTitle, rows, Section } from "@/ui/Layout";
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
            <li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
              <PasskeyIcon class="size-6" />
              <span class="text-xl font-semibold">{credential.name}</span>
              <span class={`${meta} text-grey-600 sm:ml-auto`}>
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
      <Section title="Add a passkey">
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
      </Section>
    )}
  </>
);
