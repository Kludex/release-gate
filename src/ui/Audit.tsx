import type { AuditRow } from "@/db/audit";
import { formatTime, Section } from "@/ui/Layout";

type Props = { entries: AuditRow[] };

export const Audit = ({ entries }: Props) => (
  <Section title="Audit log for repositories you administer">
    {entries.length === 0 ? (
      <p class="text-sm text-stone-500">No entries.</p>
    ) : (
      <div class="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-stone-200 text-stone-500">
            <tr>
              <th class="px-3 py-2 font-medium">Time (UTC)</th>
              <th class="px-3 py-2 font-medium">Actor</th>
              <th class="px-3 py-2 font-medium">Action</th>
              <th class="px-3 py-2 font-medium">Repository</th>
              <th class="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            {entries.map((entry) => (
              <tr>
                <td class="whitespace-nowrap px-3 py-2">{formatTime(entry.at)}</td>
                <td class="px-3 py-2">{entry.actor_login ? `@${entry.actor_login}` : "github"}</td>
                <td class="px-3 py-2 font-mono">{entry.action}</td>
                <td class="px-3 py-2">
                  {entry.request_id ? (
                    <a href={`/requests/${entry.request_id}`} class="underline">
                      {entry.repo_full_name}
                    </a>
                  ) : (
                    entry.repo_full_name
                  )}
                </td>
                <td class="break-all px-3 py-2 font-mono text-xs text-stone-500">
                  {entry.details_json}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Section>
);
