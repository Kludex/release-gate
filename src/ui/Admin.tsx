import type { Invite } from "@/db/enrollment";
import type { Approver, RepoPolicy } from "@/db/repos";
import { ChevronIcon } from "@/ui/Icons";
import { formatTime, link, meta, PageTitle, rows, Section, Tag } from "@/ui/Layout";
import { Checkbox, Field, inputClass, PasskeyForm, Select } from "@/ui/PasskeyForm";

const WORKFLOW = `on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi`;

type Props = { repo: string; policy: RepoPolicy; approvers: Approver[]; invites: Invite[] };

export const Admin = ({ repo, policy, approvers, invites }: Props) => {
  const challenge = `/admin/${repo}/challenge`;
  const admins = approvers.filter((approver) => approver.role === "admin").length;
  return (
    <>
      <PageTitle
        title={repo}
        subtitle="Who can approve releases, and what they must check. Every change asks for your passkey."
      />
      <details class="group mt-16 lg:mt-20">
        <summary class="flex cursor-pointer list-none items-center gap-3 text-2xl font-bold lg:text-3xl [&::-webkit-details-marker]:hidden">
          How do I connect a workflow?
          <ChevronIcon class="size-6 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <ol class="mt-6 max-w-[60ch] list-decimal space-y-5 pl-6 text-xl leading-relaxed marker:font-bold">
          <li>
            Run the publishing job on a tag push, in an environment:
            <pre class="mt-3 overflow-x-auto rounded-2xl bg-cream p-5 font-mono text-base leading-snug">
              {WORKFLOW}
            </pre>
          </li>
          <li>
            In{" "}
            <a href={`https://github.com/${repo}/settings/environments`} class={link}>
              the repository's environments
            </a>
            , open that environment. Under <strong>Deployment protection rules</strong>, check the
            release-gate app and turn off <strong>Allow administrators to bypass</strong>.
          </li>
          <li>Push a tag. The job waits here until approvers confirm with a passkey.</li>
        </ol>
      </details>
      <Section title="Policy">
        <PasskeyForm action={`/admin/${repo}/policy`} challenge={challenge} label="Save policy">
          <Field label="Minimum approvals">
            <input
              type="number"
              name="min_approvals"
              min={1}
              max={10}
              value={String(policy.min_approvals)}
              class={`${inputClass} max-w-32`}
            />
          </Field>
          <Checkbox name="prevent_self_review" checked={policy.prevent_self_review === 1}>
            <strong>Prevent self-review.</strong> Whoever started the deployment cannot approve it.
          </Checkbox>
          <Checkbox name="require_default_branch" checked={policy.require_default_branch === 1}>
            <strong>Require the default branch.</strong> The tagged commit must be on it.
          </Checkbox>
          <Field label="Slack or Discord webhook">
            <input
              type="url"
              name="notify_url"
              value={policy.notify_url ?? ""}
              placeholder="https://hooks.slack.com/services/..."
              class={inputClass}
            />
          </Field>
        </PasskeyForm>
      </Section>
      <Section title="Approvers">
        <ul class={rows}>
          {approvers.map((approver) => (
            <li class="flex flex-wrap items-center gap-3 py-4">
              <span class="text-xl font-semibold">@{approver.login}</span>
              <Tag color={approver.role === "admin" ? "yellow" : "grey"}>{approver.role}</Tag>
              <div class="ml-auto">
                {approver.role === "admin" && admins === 1 ? (
                  <span class={`${meta} text-grey-600`}>last admin</span>
                ) : (
                  <PasskeyForm
                    action={`/admin/${repo}/approvers/remove`}
                    challenge={challenge}
                    fields={{ user_id: String(approver.github_user_id) }}
                    label="Remove"
                    tone="danger"
                    small
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Invite an approver">
        <PasskeyForm action={`/admin/${repo}/invites`} challenge={challenge} label="Create invite">
          <div class="grid gap-8 md:grid-cols-2">
            <Field label="GitHub login">
              <input name="login" required class={inputClass} placeholder="octocat" />
            </Field>
            <Field label="Role">
              <Select name="role" options={["approver", "admin"]} />
            </Field>
          </div>
        </PasskeyForm>
        {invites.length > 0 && (
          <ul class={rows}>
            {invites.map((invite) => (
              <li class="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 text-xl">
                <strong class="font-semibold">
                  @{invite.github_login} ({invite.role})
                </strong>
                <span class={`${meta} text-grey-600 sm:ml-auto`}>
                  expires <time>{formatTime(invite.expires_at)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
};
