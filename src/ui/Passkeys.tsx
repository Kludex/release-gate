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
              {credentials.length === 1 ? (
                <span class="group relative">
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-describedby="last-passkey"
                    class="inline-flex cursor-not-allowed items-center gap-2.5 rounded-full border-2 border-grey-200 px-4 py-1.5 text-base font-semibold text-grey-600"
                  >
                    <PasskeyIcon class="size-4 shrink-0" />
                    Remove
                  </button>
                  <span
                    id="last-passkey"
                    role="tooltip"
                    class="pointer-events-none absolute right-0 bottom-full mb-2 w-max rounded-xl bg-black px-3 py-1.5 text-sm text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    Add a second passkey first
                  </span>
                </span>
              ) : (
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
