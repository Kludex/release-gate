import type { Invite } from "@/db/enrollment";
import type { Approver, RepoPolicy } from "@/db/repos";
import { Card, formatTime, Section } from "@/ui/Layout";
import { inputClass, PasskeyForm } from "@/ui/PasskeyForm";

type Props = { repo: string; policy: RepoPolicy; approvers: Approver[]; invites: Invite[] };

const Checkbox = ({ name, checked, label }: { name: string; checked: number; label: string }) => (
  <label class="flex items-center gap-2 text-sm">
    <input type="checkbox" name={name} value="1" checked={checked === 1} />
    {label}
  </label>
);

export const Admin = ({ repo, policy, approvers, invites }: Props) => {
  const challenge = `/admin/${repo}/challenge`;
  return (
    <>
      <h1 class="text-xl font-semibold">{repo}</h1>
      <Section title="Policy">
        <Card>
          <PasskeyForm action={`/admin/${repo}/policy`} challenge={challenge} label="Save policy">
            <label class="block space-y-1 text-sm">
              <span>Minimum approvals</span>
              <input
                type="number"
                name="min_approvals"
                min={1}
                max={10}
                value={String(policy.min_approvals)}
                class={inputClass}
              />
            </label>
            <Checkbox
              name="prevent_self_review"
              checked={policy.prevent_self_review}
              label="Prevent self-review: whoever started the deployment cannot approve it"
            />
            <Checkbox
              name="require_default_branch"
              checked={policy.require_default_branch}
              label="Require the tagged commit to be on the default branch"
            />
          </PasskeyForm>
        </Card>
      </Section>
      <Section title="Approvers">
        <ul class="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
          {approvers.map((approver) => (
            <li class="flex items-center gap-3 px-4 py-3">
              <span class="font-medium">@{approver.login}</span>
              <span class="text-stone-500">{approver.role}</span>
              <div class="ml-auto">
                <PasskeyForm
                  action={`/admin/${repo}/approvers/remove`}
                  challenge={challenge}
                  fields={{ user_id: String(approver.github_user_id) }}
                  label="Remove"
                  tone="danger"
                />
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Invite an approver">
        <Card>
          <PasskeyForm
            action={`/admin/${repo}/invites`}
            challenge={challenge}
            label="Create invite"
          >
            <label class="block space-y-1 text-sm">
              <span>GitHub login</span>
              <input name="login" required class={inputClass} />
            </label>
            <label class="block space-y-1 text-sm">
              <span>Role</span>
              <select name="role" class={inputClass}>
                <option value="approver">approver</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </PasskeyForm>
          {invites.length > 0 && (
            <ul class="mt-4 space-y-1 text-sm text-stone-600">
              {invites.map((invite) => (
                <li>
                  @{invite.github_login} ({invite.role}) - expires {formatTime(invite.expires_at)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>
    </>
  );
};
