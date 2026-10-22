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
            <li class="flex items-center gap-4 py-4">
              <PasskeyIcon class="size-6 shrink-0" />
              <div class="min-w-0 flex-1 space-y-0.5">
                <span class="block break-words text-xl font-semibold">{credential.name}</span>
                <span class={`${meta} block text-grey-600`}>
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
              </div>
              {credentials.length > 1 && (
                <PasskeyForm
                  action="/passkeys/revoke"
                  challenge="/passkeys/revoke/challenge"
                  fields={{ credential_id: credential.credential_id }}
                  label="Remove"
                  tone="danger"
                  small
                />
              )}
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
          <Field label="Name (optional)">
            <input
              name="name"
              maxlength={64}
              class={`${inputClass} max-w-md`}
              placeholder="Detected from your device"
            />
          </Field>
        </PasskeyForm>
      </Section>
    )}
  </>
);
