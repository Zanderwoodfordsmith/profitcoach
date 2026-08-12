/**
 * Completes the classroom id rename: expands the map for remaining hub + DB
 * leftovers, rewrites classroom-hub.json, regenerates aliases, and emits
 * a follow-up SQL migration.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const existing = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/academy-id-rename-map.json"), "utf8")
);

function renameId(id) {
  if (!id || typeof id !== "string") return id;
  if (existing.lessonMap[id]) return existing.lessonMap[id];
  if (existing.sectionMap?.[id]) return existing.sectionMap[id];
  if (existing.courseMap?.[id]) return existing.courseMap[id];

  if (id === "profit-coach-system-overview") return "coach-clients-overview";
  if (id === "profit-coach-system-tool-library") return "coach-clients-tool-library";

  // Win Clients subsections still under client-acquisition-* in the hub.
  const winPrefixes = [
    "client-acquisition-step-5-",
    "client-acquisition-getting-paid-clients-using-value-sessions-",
    "client-acquisition-step-6-",
    "client-acquisition-sales-pitch-",
    "client-acquisition-client-closing-",
  ];
  for (const p of winPrefixes) {
    if (id.startsWith(p) || id === p.slice(0, -1)) {
      return `win-clients-${id.slice("client-acquisition-".length)}`;
    }
  }

  if (id.startsWith("kickstart-")) {
    return `start-here-${id.slice("kickstart-".length)}`;
  }
  if (id.startsWith("client-acquisition-")) {
    return `get-calls-${id.slice("client-acquisition-".length)}`;
  }
  if (id.startsWith("client-delivery-")) {
    return `coach-clients-${id.slice("client-delivery-".length)}`;
  }
  if (id.startsWith("client-retention-")) {
    return `coach-clients-retention-${id.slice("client-retention-".length)}`;
  }
  if (id.startsWith("profit-coach-certification-")) {
    return `coach-clients-certification-${id.slice("profit-coach-certification-".length)}`;
  }
  if (id.startsWith("going-pro-iii-1-day-zero-")) {
    return `going-pro-day-zero-${id.slice("going-pro-iii-1-day-zero-".length)}`;
  }
  if (id.startsWith("profit-coach-system-")) {
    return `coach-clients-${id.slice("profit-coach-system-".length)}`;
  }
  return id;
}

function walkRename(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walkRename(child);
    return;
  }
  if (typeof node.id === "string") {
    const next = renameId(node.id);
    if (next !== node.id) node.id = next;
  }
  for (const value of Object.values(node)) walkRename(value);
}

function collectIds(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectIds(child, out);
    return out;
  }
  if (typeof node.id === "string") out.add(node.id);
  for (const value of Object.values(node)) collectIds(value, out);
  return out;
}

const hubPath = path.join(root, "content/academy/classroom-hub.json");
const hub = JSON.parse(fs.readFileSync(hubPath, "utf8"));
const beforeIds = [...collectIds(hub)];

walkRename(hub);
fs.writeFileSync(hubPath, `${JSON.stringify(hub, null, 2)}\n`);

const afterIds = [...collectIds(hub)];
const hubRenames = {};
for (const id of beforeIds) {
  const next = renameId(id);
  if (next !== id) hubRenames[id] = next;
}

// Seed lesson map from existing + hub renames + common orphan DB prefixes.
const lessonMap = { ...existing.lessonMap, ...hubRenames };

// Explicit section renames beyond lesson map.
const sectionMap = {
  ...existing.sectionMap,
  "client-acquisition-step-5-value-sessions": "win-clients-step-5-value-sessions",
  "client-acquisition-step-6-sales-calls": "win-clients-step-6-sales-calls",
  "profit-coach-system-overview": "coach-clients-overview",
  "profit-coach-system-tool-library": "coach-clients-tool-library",
  "profit-coach-certification-welcome-to-the-profit-coach-certification":
    "coach-clients-certification-welcome-to-the-profit-coach-certification",
  "profit-coach-certification-coaching-foundations":
    "coach-clients-certification-coaching-foundations",
  "profit-coach-certification-the-exact-questions-to-ask-clients":
    "coach-clients-certification-the-exact-questions-to-ask-clients",
  "profit-coach-certification-becoming-a-world-class-business-coach":
    "coach-clients-certification-becoming-a-world-class-business-coach",
  "profit-coach-certification-create-lasting-transformation":
    "coach-clients-certification-create-lasting-transformation",
};

for (const [oldId, newId] of Object.entries(sectionMap)) {
  if (!lessonMap[oldId]) lessonMap[oldId] = newId;
}

const mapOut = {
  courseMap: existing.courseMap,
  sectionMap,
  lessonMap,
  progressCourseForLessonNote: "derived from lesson prefix after rename",
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(root, "scripts/academy-id-rename-map.json"),
  `${JSON.stringify(mapOut, null, 2)}\n`
);

// Generated aliases = full lesson map (old → new only).
const aliasEntries = Object.entries(lessonMap).sort(([a], [b]) =>
  a.localeCompare(b)
);
const aliasTs = `/** Auto-generated by scripts/complete-academy-id-rename.mjs — do not edit by hand. */
export const CLASSROOM_LESSON_ID_ALIASES: Record<string, string> = {
${aliasEntries.map(([o, n]) => `  ${JSON.stringify(o)}: ${JSON.stringify(n)},`).join("\n")}
};
`;
fs.writeFileSync(
  path.join(root, "src/lib/academy/classroomLessonIdAliases.generated.ts"),
  aliasTs
);

// Follow-up SQL for any map entries not in pass 1.
const pass1 = new Set(Object.keys(existing.lessonMap));
const pass2 = aliasEntries.filter(([oldId]) => !pass1.has(oldId));

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

const sqlValues = pass2
  .map(([o, n]) => `  ('${sqlEscape(o)}', '${sqlEscape(n)}')`)
  .join(",\n");

const sql = `-- Academy id rename pass 2: remaining win-clients + certification + orphan content.
-- Complements 20261014130000_academy_classroom_id_rename.sql

create temporary table academy_lesson_id_map (
  old_lesson_id text primary key,
  new_lesson_id text not null
) on commit drop;

insert into academy_lesson_id_map (old_lesson_id, new_lesson_id) values
${sqlValues};

-- Prefix catch-all for orphan DB rows not listed above (idempotent with map).
insert into academy_lesson_id_map (old_lesson_id, new_lesson_id)
select c.lesson_id,
  case
    when c.lesson_id like 'kickstart-%' then 'start-here-' || substr(c.lesson_id, length('kickstart-') + 1)
    when c.lesson_id like 'client-delivery-%' then 'coach-clients-' || substr(c.lesson_id, length('client-delivery-') + 1)
    when c.lesson_id like 'client-retention-%' then 'coach-clients-retention-' || substr(c.lesson_id, length('client-retention-') + 1)
    when c.lesson_id like 'profit-coach-certification-%' then 'coach-clients-certification-' || substr(c.lesson_id, length('profit-coach-certification-') + 1)
    when c.lesson_id like 'profit-coach-system-%' then 'coach-clients-' || substr(c.lesson_id, length('profit-coach-system-') + 1)
    when c.lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or c.lesson_id like 'client-acquisition-sales-pitch-%'
      or c.lesson_id like 'client-acquisition-client-closing-%'
      or c.lesson_id like 'client-acquisition-step-5-%'
      or c.lesson_id like 'client-acquisition-step-6-%'
      then 'win-clients-' || substr(c.lesson_id, length('client-acquisition-') + 1)
    when c.lesson_id like 'client-acquisition-%' then 'get-calls-' || substr(c.lesson_id, length('client-acquisition-') + 1)
    else null
  end
from public.academy_lesson_content c
where (
  c.lesson_id like 'kickstart-%'
  or c.lesson_id like 'client-delivery-%'
  or c.lesson_id like 'client-retention-%'
  or c.lesson_id like 'profit-coach-certification-%'
  or c.lesson_id like 'profit-coach-system-%'
  or c.lesson_id like 'client-acquisition-%'
)
and not exists (select 1 from academy_lesson_id_map m where m.old_lesson_id = c.lesson_id)
on conflict do nothing;

insert into academy_lesson_id_map (old_lesson_id, new_lesson_id)
select p.lesson_id,
  case
    when p.lesson_id like 'kickstart-%' then 'start-here-' || substr(p.lesson_id, length('kickstart-') + 1)
    when p.lesson_id like 'client-delivery-%' then 'coach-clients-' || substr(p.lesson_id, length('client-delivery-') + 1)
    when p.lesson_id like 'client-retention-%' then 'coach-clients-retention-' || substr(p.lesson_id, length('client-retention-') + 1)
    when p.lesson_id like 'profit-coach-certification-%' then 'coach-clients-certification-' || substr(p.lesson_id, length('profit-coach-certification-') + 1)
    when p.lesson_id like 'profit-coach-system-%' then 'coach-clients-' || substr(p.lesson_id, length('profit-coach-system-') + 1)
    when p.lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or p.lesson_id like 'client-acquisition-sales-pitch-%'
      or p.lesson_id like 'client-acquisition-client-closing-%'
      or p.lesson_id like 'client-acquisition-step-5-%'
      or p.lesson_id like 'client-acquisition-step-6-%'
      then 'win-clients-' || substr(p.lesson_id, length('client-acquisition-') + 1)
    when p.lesson_id like 'client-acquisition-%' then 'get-calls-' || substr(p.lesson_id, length('client-acquisition-') + 1)
    else null
  end
from public.academy_lesson_progress p
where (
  p.lesson_id like 'kickstart-%'
  or p.lesson_id like 'client-delivery-%'
  or p.lesson_id like 'client-retention-%'
  or p.lesson_id like 'profit-coach-certification-%'
  or p.lesson_id like 'profit-coach-system-%'
  or p.lesson_id like 'client-acquisition-%'
)
and not exists (select 1 from academy_lesson_id_map m where m.old_lesson_id = p.lesson_id)
on conflict do nothing;

delete from academy_lesson_id_map where new_lesson_id is null or new_lesson_id = old_lesson_id;

create or replace function public.academy_canonical_course_id(
  p_course_id text,
  p_lesson_id text
)
returns text
language sql
immutable
as $$
  select case
    when p_lesson_id like 'profit-coach-os-%' then 'profit-coach-os'
    when p_lesson_id like 'coach-clients-%' then 'coach-clients'
    when p_lesson_id like 'win-clients-%' then 'win-clients'
    when p_lesson_id like 'get-calls-%' then 'get-calls'
    when p_lesson_id like 'start-here-%' then 'start-here'
    when p_lesson_id like 'coach-action-plan-%' then 'coach-action-plan'
    when p_lesson_id like 'going-pro-%' then 'going-pro'
    when p_lesson_id like 'profit-coach-certification-%' then 'coach-clients'
    when p_lesson_id like 'profit-brand-framework-%' then 'profit-brand-framework'
    when p_lesson_id like 'client-acquisition-getting-paid-clients-using-value-sessions-%'
      or p_lesson_id like 'client-acquisition-sales-pitch-%'
      or p_lesson_id like 'client-acquisition-client-closing-%'
      then 'win-clients'
    when p_lesson_id like 'client-acquisition-%' then 'get-calls'
    when p_lesson_id like 'client-delivery-%' then 'coach-clients'
    when p_lesson_id like 'client-retention-%' then 'coach-clients'
    when p_lesson_id like 'kickstart-%' then 'start-here'
    else p_course_id
  end
$$;

update public.academy_lesson_progress t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_progress x
    where x.user_id = t.user_id and x.course_id = t.course_id and x.lesson_id = m.new_lesson_id
  );

update public.academy_lesson_views t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_views x
    where x.user_id = t.user_id and x.course_id = t.course_id and x.lesson_id = m.new_lesson_id
  );

update public.academy_lesson_progress_events t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id;

insert into public.academy_lesson_content (
  course_id, lesson_id, title, body_markdown, guide_markdown, transcript_text,
  video_url, audio_url, duration, is_draft, is_deleted, recommended_actions, updated_at
)
select
  public.academy_canonical_course_id(c.course_id, coalesce(lm.new_lesson_id, c.lesson_id)),
  coalesce(lm.new_lesson_id, c.lesson_id),
  c.title, c.body_markdown, c.guide_markdown, c.transcript_text,
  c.video_url, c.audio_url, c.duration, c.is_draft, c.is_deleted, c.recommended_actions, c.updated_at
from public.academy_lesson_content c
join academy_lesson_id_map lm on lm.old_lesson_id = c.lesson_id
on conflict (course_id, lesson_id) do update set
  title = excluded.title,
  body_markdown = excluded.body_markdown,
  guide_markdown = excluded.guide_markdown,
  transcript_text = excluded.transcript_text,
  video_url = excluded.video_url,
  audio_url = excluded.audio_url,
  duration = excluded.duration,
  is_draft = excluded.is_draft,
  is_deleted = excluded.is_deleted,
  recommended_actions = excluded.recommended_actions,
  updated_at = excluded.updated_at;

delete from public.academy_lesson_content c
using academy_lesson_id_map lm
where c.lesson_id = lm.old_lesson_id;

update public.academy_lesson_resources t
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id
  and not exists (
    select 1 from public.academy_lesson_resources x
    where x.course_id = t.course_id
      and x.lesson_id = m.new_lesson_id
      and x.resource_id = t.resource_id
  );

delete from public.academy_lesson_resources t
using academy_lesson_id_map m
where t.lesson_id = m.old_lesson_id;

update public.academy_lesson_resources t
set course_id = public.academy_canonical_course_id(t.course_id, t.lesson_id)
where t.course_id is distinct from public.academy_canonical_course_id(t.course_id, t.lesson_id)
  and not exists (
    select 1 from public.academy_lesson_resources x
    where x.course_id = public.academy_canonical_course_id(t.course_id, t.lesson_id)
      and x.lesson_id = t.lesson_id
      and x.resource_id = t.resource_id
  );

delete from public.academy_lesson_resources t
where t.course_id is distinct from public.academy_canonical_course_id(t.course_id, t.lesson_id);

with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    status,
    updated_at,
    row_number() over (
      partition by user_id, public.academy_canonical_course_id(course_id, lesson_id), lesson_id
      order by case status when 'completed' then 0 when 'needs_review' then 1 else 2 end, updated_at desc
    ) as rn
  from public.academy_lesson_progress
)
insert into public.academy_lesson_progress (user_id, course_id, lesson_id, status, updated_at)
select user_id, canonical_course_id, lesson_id, status, updated_at from ranked where rn = 1
on conflict (user_id, course_id, lesson_id) do update set
  status = case
    when public.academy_lesson_progress.status = 'completed' then 'completed'
    when excluded.status = 'completed' then 'completed'
    else excluded.status
  end,
  updated_at = greatest(public.academy_lesson_progress.updated_at, excluded.updated_at);

delete from public.academy_lesson_progress
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

with ranked as (
  select
    user_id,
    public.academy_canonical_course_id(course_id, lesson_id) as canonical_course_id,
    lesson_id,
    viewed_at,
    row_number() over (
      partition by user_id, public.academy_canonical_course_id(course_id, lesson_id), lesson_id
      order by viewed_at desc
    ) as rn
  from public.academy_lesson_views
)
insert into public.academy_lesson_views (user_id, course_id, lesson_id, viewed_at)
select user_id, canonical_course_id, lesson_id, viewed_at from ranked where rn = 1
on conflict (user_id, course_id, lesson_id) do update set
  viewed_at = greatest(public.academy_lesson_views.viewed_at, excluded.viewed_at);

delete from public.academy_lesson_views
where course_id is distinct from public.academy_canonical_course_id(course_id, lesson_id);

update public.coach_action_items
set academy_lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where academy_lesson_id = m.old_lesson_id;

update public.coach_action_items api
set academy_course_id = public.academy_canonical_course_id(
  coalesce(api.academy_course_id, ''),
  api.academy_lesson_id
)
where api.academy_lesson_id is not null
  and api.academy_course_id is distinct from public.academy_canonical_course_id(
    coalesce(api.academy_course_id, ''),
    api.academy_lesson_id
  );

update public.community_posts p
set lesson_id = m.new_lesson_id
from academy_lesson_id_map m
where p.post_scope = 'lesson_qa'
  and p.lesson_id = m.old_lesson_id;

update public.community_posts p
set lesson_course_id = public.academy_canonical_course_id(
  coalesce(p.lesson_course_id, ''),
  p.lesson_id
)
where p.post_scope = 'lesson_qa'
  and p.lesson_id is not null
  and p.lesson_course_id is distinct from public.academy_canonical_course_id(
    coalesce(p.lesson_course_id, ''),
    p.lesson_id
  );
`;

const migPath = path.join(
  root,
  "supabase/migrations/20261014140000_academy_classroom_id_rename_pass2.sql"
);
fs.writeFileSync(migPath, sql);

const leftover = afterIds.filter(
  (id) =>
    id.startsWith("kickstart-") ||
    id.startsWith("client-acquisition-") ||
    id.startsWith("client-delivery-") ||
    id.startsWith("client-retention-") ||
    id.startsWith("profit-coach-certification-") ||
    id.startsWith("profit-coach-system-")
);

console.log({
  hubRenames: Object.keys(hubRenames).length,
  pass2MapEntries: pass2.length,
  totalLessonMap: Object.keys(lessonMap).length,
  hubOldLeftover: leftover.length,
  leftoverSample: leftover.slice(0, 10),
  migration: migPath,
});
