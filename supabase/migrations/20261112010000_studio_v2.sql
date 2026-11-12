-- =====================================================================
-- 국어 스튜디오 v2  (kor_core v1.1 다음에 적용)
--  1 주석 달기 / 2 주석교재(첨부자료·구조도) / 3+6 시험지 제작(설계도·유사도·검토)
--  5+7 시험지 분석·저장(OCR 통합·이미지·저작권 차단 대체) / 8 디자인 작업대(배너 슬롯)
--  9 에이전트 API / 11 설정
--  4 지문 생성, 10 학급 운영은 만들지 않음
-- =====================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 0. 개인 지문 허용 + 지문 세그먼트 (모든 주석·문항 근거의 기준 좌표)
-- ---------------------------------------------------------------------
alter table passages add column owner_id  uuid references profiles on delete cascade;
alter table passages add column norm_hash text;   -- 공백·문장부호 정규화 후 해시 (같은 작품 재사용)
create index on passages (norm_hash);

drop policy "read" on passages;
drop policy "admin write" on passages;
create policy "passage read" on passages for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy "passage write" on passages for all to authenticated
  using (owner_id = auth.uid() or (owner_id is null and is_admin()))
  with check (owner_id = auth.uid() or (owner_id is null and is_admin()));

create table passage_segments (
  passage_id bigint references passages on delete cascade,
  seg_id     int not null,
  kind       text not null check (kind in ('para','sent','line')),
  parent_seg int,
  start_off  int not null,
  end_off    int not null check (end_off > start_off),
  text       text not null,
  embedding  vector(768),
  primary key (passage_id, seg_id)
);

-- ---------------------------------------------------------------------
-- 1. 에이전트 API 키 · 작업 큐 · 연필 원장 (화면 = API = 에이전트 도구)
-- ---------------------------------------------------------------------
create table api_keys (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references profiles on delete cascade,
  name              text not null,
  prefix            text not null,                 -- 화면 표시용 앞 8자
  key_hash          text not null unique,          -- sha256(키). 원문은 저장하지 않음
  scopes            text[] not null default array['jobs:read','jobs:write','assets:write'],
  monthly_pencil_cap int,
  last_used_at      timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz default now()
);

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles on delete cascade,
  kind            text not null check (kind in ('ocr','analyze','annotate','textbook','build','render')),
  status          text not null default 'queued'
                  check (status in ('quoted','queued','running','needs_review','completed','failed','cancelled')),
  stage           text,
  progress        numeric(5,2) default 0,
  input           jsonb not null,
  result          jsonb,
  error           jsonb,               -- {code, message, retryable, retry_after}
  quote_pencils   int,
  charged_pencils int not null default 0,
  idempotency_key text,
  created_via     text not null default 'ui' check (created_via in ('ui','api','mcp','agent')),
  api_key_id      uuid references api_keys on delete set null,
  webhook_url     text,
  parent_job_id   uuid references jobs on delete set null,
  created_at      timestamptz default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  unique (owner_id, idempotency_key)
);
create index on jobs (owner_id, created_at desc);

create table job_events (
  id     bigint generated always as identity primary key,
  job_id uuid references jobs on delete cascade,
  at     timestamptz default now(),
  type   text not null,          -- stage_changed, progress, fallback, warning, completed …
  data   jsonb
);
create index on job_events (job_id, id);

create table pencil_ledger (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references profiles on delete cascade,
  delta      int not null,
  reason     text not null check (reason in ('reserve','settle','refund','topup','adjust')),
  job_id     uuid references jobs on delete set null,
  created_at timestamptz default now()
);

create view v_pencil_balance with (security_invoker = true) as
select owner_id, sum(delta) as balance from pencil_ledger group by owner_id;

create view v_api_key_usage with (security_invoker = true) as
select k.id, k.name, k.prefix, k.monthly_pencil_cap, k.revoked_at,
  coalesce(sum(j.charged_pencils) filter (where j.created_at >= date_trunc('month', now())), 0) as used_this_month
from api_keys k
left join jobs j on j.api_key_id = k.id
group by k.id;

create table webhooks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  url         text not null check (url like 'https://%'),
  secret_hash text not null,
  events      text[] not null default array['job.completed','job.failed'],
  active      boolean default true,
  created_at  timestamptz default now()
);

-- 작업 요청창에서 저장한 반복 요청
create table agent_routines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  name        text not null,
  request     text not null,        -- 자연어 요청 원문
  plan        jsonb,                -- 에이전트가 만든 단계 계획 [{kind, input}]
  schedule    text,                 -- RRULE
  last_run_at timestamptz,
  created_at  timestamptz default now()
);

-- 작업 취소 (사용자는 jobs를 직접 수정하지 않음)
create or replace function cancel_job(p_job uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update jobs set status = 'cancelled', finished_at = now()
  where id = p_job and owner_id = auth.uid() and status in ('quoted','queued','running','needs_review');
  return found;
end $$;

-- ---------------------------------------------------------------------
-- 2. 파일 자산 (Supabase Storage 비공개 버킷 'studio/{uid}/...')
-- ---------------------------------------------------------------------
create table assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles on delete cascade,
  kind         text not null check (kind in ('source','attachment','page_image','banner','logo','cover','illustration','output')),
  storage_path text not null,
  filename     text,
  mime         text not null,
  bytes        bigint,
  sha256       text,
  width        int,
  height       int,
  created_at   timestamptz default now()
);
create index on assets (owner_id, kind);
create index on assets (owner_id, sha256);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio', 'studio', false, 104857600,
        array['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/heif','image/svg+xml',
              'text/plain','application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp',
              'application/vnd.hancom.hwpx','application/hwp+zip','application/octet-stream'])
on conflict (id) do nothing;

create policy "studio own files" on storage.objects for all to authenticated
  using (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'studio' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 3. 시험지 분석·저장: 문서 · 쪽 · OCR 줄 · 엔진 시도 기록 (5 + 7)
-- ---------------------------------------------------------------------
create table documents (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles on delete cascade,
  title            text not null,
  role             text not null default '시험지'
                   check (role in ('시험지','지문','학교프린트','교사용교과서','자습서','평가문제집','기출','수업필기','기타')),
  source_asset_ids uuid[] not null default '{}',     -- 이미지 여러 장 업로드 시 순서대로
  input_kind       text check (input_kind in ('hwp','hwpx','txt','pdf_text','pdf_scan','image')),
  page_count       int,
  status           text not null default 'uploaded'
                   check (status in ('uploaded','preprocessing','ocr','structuring','review','ready','failed')),
  created_at       timestamptz default now()
);

create table document_pages (
  document_id      uuid references documents on delete cascade,
  page_no          int not null,
  image_asset_id   uuid references assets on delete set null,
  preprocess       jsonb,          -- {deskew, perspective, rotate, split:'left'|'right', denoise, columns}
  text_source      text check (text_source in ('parsed','pdf_text','ocr')),
  final_engine     text,
  fallback_path    text[],         -- 예: {gemini:blocked_copyright, reference_mode:ok}
  confidence       numeric(4,3),
  unreadable_count int default 0,
  reviewed         boolean default false,
  primary key (document_id, page_no)
);

create table ocr_lines (
  document_id uuid not null,
  page_no     int not null,
  line_no     int not null,
  text        text not null,
  bbox        int[],               -- [x, y, w, h] (원본 이미지 픽셀)
  confidence  numeric(4,3),
  alt_text    text,                -- 두 번째 엔진 판독 (불일치 시)
  status      text not null default 'ok' check (status in ('ok','low_conf','disagree','edited','unreadable')),
  primary key (document_id, page_no, line_no),
  foreign key (document_id, page_no) references document_pages (document_id, page_no) on delete cascade
);

create table ocr_attempts (
  id             bigint generated always as identity primary key,
  job_id         uuid references jobs on delete cascade,
  document_id    uuid not null,
  page_no        int not null,
  step           smallint not null,
  engine         text not null check (engine in ('gemini','reference_mode','qwen_vl','tile_mode','dedicated_ocr','rule_based','manual')),
  outcome        text not null check (outcome in ('ok','blocked_copyright','blocked_safety','truncated','error','low_quality')),
  finish_reason  text,
  chars          int,
  expected_chars int,
  tokens_in      int,
  tokens_out     int,
  pencils        int not null default 0,     -- 성공한 시도만 과금
  duration_ms    int,
  created_at     timestamptz default now(),
  foreign key (document_id, page_no) references document_pages (document_id, page_no) on delete cascade
);
create index on ocr_attempts (job_id, document_id, page_no);

-- 응답을 결과 유형으로 분류 (차단·잘림이면 다음 엔진으로)
create or replace function classify_ocr_outcome(p_finish text, p_chars int, p_expected int)
returns text language sql immutable as $$
  select case
    when upper(coalesce(p_finish, '')) = 'RECITATION' then 'blocked_copyright'
    when upper(coalesce(p_finish, '')) in ('SAFETY','PROHIBITED_CONTENT','BLOCKLIST','SPII') then 'blocked_safety'
    when coalesce(p_chars, 0) = 0 then 'error'
    when coalesce(p_expected, 0) > 0 and p_chars < p_expected * 0.5 then 'truncated'
    else 'ok' end;
$$;

-- 쪽마다 다음에 시도할 엔진 (이미 성공했으면 null)
create or replace function next_ocr_engine(
  p_job uuid, p_doc uuid, p_page int,
  p_chain text[] default array['gemini','reference_mode','qwen_vl','tile_mode','dedicated_ocr','rule_based','manual'])
returns text language sql stable as $$
  select c.e
  from unnest(p_chain) with ordinality as c(e, ord)
  where not exists (select 1 from ocr_attempts a
                    where a.job_id = p_job and a.document_id = p_doc and a.page_no = p_page and a.engine = c.e)
    and not exists (select 1 from ocr_attempts a
                    where a.job_id = p_job and a.document_id = p_doc and a.page_no = p_page and a.outcome = 'ok')
  order by c.ord
  limit 1;
$$;

-- 시험지 분석 리포트 + 문항별 분석 (동형 설계도의 원천)
create table exam_analyses (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references profiles on delete cascade,
  document_id        uuid references documents on delete set null,
  title              text not null,             -- 예: 26-1-1 중간 수원고
  school             text,
  school_year        smallint,
  term               text,
  grade              grade_level,
  expected_first_cut numeric(5,1),
  hard_items         smallint[],
  trend_note         text,
  report             jsonb,                      -- 학부모용 리포트
  status             text not null default '검수 필요' check (status in ('생성 준비','검수 필요','검수 완료')),
  created_at         timestamptz default now()
);

create table analysis_items (
  analysis_id       uuid references exam_analyses on delete cascade,
  number            smallint not null,
  domain            text check (domain in ('POETRY','NOVEL','READING','SPEECH_WRITING','GRAMMAR','MEDIA','UNKNOWN')),
  taxonomy_id       text references taxonomy,
  item_type         text references item_types,
  skill_label       text,
  format_family     text,
  format_signals    text[],
  difficulty        text check (difficulty in ('상','중','하')),
  confidence        numeric(3,2),
  is_hard           boolean default false,
  stem_skeleton     text,
  question_intent   text,
  expected_mistake  text,
  line_refs         jsonb,     -- 참조형 구조화 결과 {stem:[L040,L041], boogi:[…], choices:{"1":[…]}}
  teacher_confirmed boolean not null default false,
  primary key (analysis_id, number)
);

-- 신뢰도 0.65 미만은 교사 확인 전까지 동형 출제에 사용 안 함
create view v_analysis_items_usable with (security_invoker = true) as
select * from analysis_items where teacher_confirmed or confidence >= 0.65;

-- ---------------------------------------------------------------------
-- 4. 주석 달기 (1)
-- ---------------------------------------------------------------------
create table annotation_sets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles on delete cascade,
  passage_id    bigint not null references passages on delete cascade,
  status        text not null default 'draft' check (status in ('preview','draft','confirmed')),
  based_on_set  uuid references annotation_sets on delete set null,   -- 같은 작품 재사용 시 원본
  model         text,
  job_id        uuid references jobs on delete set null,
  created_at    timestamptz default now()
);

create table annotations (
  id                 bigint generated always as identity primary key,
  set_id             uuid not null references annotation_sets on delete cascade,
  passage_id         bigint not null references passages on delete cascade,
  start_off          int not null,
  end_off            int not null check (end_off > start_off),
  seg_id             int,
  quote              text not null,
  category           text not null check (category in ('어휘','현대어풀이','표현법','화자·정서','인물·사건','구조','배경','문법','출제포인트','기출연계')),
  note               text not null check (char_length(note) <= 160),
  level              smallint not null check (level between 1 and 5),   -- 1 = 가장 중요 (필기량 1에서도 표시)
  priority           numeric(5,3),
  source             text not null default 'ai' check (source in ('rule','ai','attachment','teacher','exam_bank')),
  source_document_id uuid references documents on delete set null,
  source_page        int,
  exam_refs          jsonb,          -- [{exam_id, number, label:"2025 9모 23번"}]
  text_color         text check (text_color in ('default','navy','cobalt','crimson','forest','violet','ochre')),
  highlight_color    text check (highlight_color in ('none','yellow','lime','mint','sky','pink','lavender','peach')),
  anchor_status      text not null default 'exact' check (anchor_status in ('exact','fuzzy','lost')),
  pinned             boolean not null default false,
  hidden             boolean not null default false,
  conflict_group     int,            -- 출처끼리 해석이 다를 때 같은 번호
  created_at         timestamptz default now()
);
create index on annotations (set_id, start_off);

-- 필기량(1~5)에 맞는 주석만: 재생성 없이 렌더 단계에서 필터
create or replace function annotations_at_density(p_set uuid, p_density int)
returns setof annotations language sql stable as $$
  select * from annotations
  where set_id = p_set and not hidden and (pinned or level <= p_density)
  order by start_off, level;
$$;

-- 우선순위 점수 = 출처 0.4 + 기출 빈도 0.3 + 난도(오답률) 0.2 + 교사 고정 0.1
create or replace function annotation_priority(p_source_w numeric, p_exam_hits int, p_wrong_rate numeric, p_pinned boolean)
returns numeric language sql immutable as $$
  select round(0.4 * coalesce(p_source_w, 0.6)
             + 0.3 * least(coalesce(p_exam_hits, 0), 5) / 5.0
             + 0.2 * coalesce(p_wrong_rate, 50) / 100.0
             + 0.1 * (case when p_pinned then 1 else 0 end), 3);
$$;

-- ---------------------------------------------------------------------
-- 5. 주석교재: 첨부자료 정렬 · 구조도 (2)
-- ---------------------------------------------------------------------
create or replace function attachment_weight(p_role text) returns numeric
language sql immutable as $$
  select case p_role
    when '학교프린트'   then 1.0
    when '교사용교과서' then 0.9
    when '기출'         then 0.9
    when '자습서'       then 0.8
    when '평가문제집'   then 0.8
    when '수업필기'     then 0.7
    else 0.6 end;
$$;

create table passage_schemas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  passage_id bigint not null references passages on delete cascade,
  kind       text not null check (kind in ('시상전개','화자정서흐름','인물관계','사건흐름','공간이동','문단구조','개념관계','비교표','분류트리')),
  graph      jsonb not null check (jsonb_typeof(graph -> 'nodes') = 'array'),
             -- {nodes:[{id,label,seg_ids:[…]}], edges:[{from,to,label}]}
  layout     jsonb,              -- 교사가 옮긴 노드 좌표
  source     text not null default 'ai' check (source in ('ai','teacher')),
  created_at timestamptz default now()
);

create table textbooks (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles on delete cascade,
  title            text not null,
  density          smallint not null default 3 check (density between 1 and 5),
  target_pages     numeric(4,1),            -- 넣으면 필기량 자동 조정
  layout           text not null default 'wing' check (layout in ('wing','note','study_guide','tutor','blank','teacher')),
  schema_kinds     text[] not null default '{}',
  design_preset_id uuid,
  settings         jsonb,
  status           text not null default 'draft' check (status in ('draft','confirmed')),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table textbook_units (
  textbook_id       uuid references textbooks on delete cascade,
  ord               int not null,
  passage_id        bigint not null references passages,
  annotation_set_id uuid references annotation_sets on delete set null,
  density_override  smallint check (density_override between 1 and 5),
  primary key (textbook_id, ord)
);

create table textbook_attachments (
  textbook_id uuid references textbooks on delete cascade,
  document_id uuid references documents on delete cascade,
  weight      numeric(3,2) not null default 0.8,   -- 기본값은 attachment_weight(documents.role)
  primary key (textbook_id, document_id)
);

create table attachment_alignments (
  document_id      uuid not null references documents on delete cascade,
  passage_id       bigint not null,
  seg_id           int not null,
  doc_page         int not null,
  doc_line_from    int not null,
  doc_line_to      int not null,
  similarity       numeric(4,3),
  extracted_note   text,             -- 풀어 쓴 주석 후보 (원문 복제 아님)
  verbatim_overlap numeric(4,3),     -- 8-gram 겹침 비율. 0.3 초과면 다시 풀어 씀
  primary key (document_id, passage_id, seg_id, doc_page, doc_line_from),
  foreign key (passage_id, seg_id) references passage_segments (passage_id, seg_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 6. 시험지 제작: 설계도 · 후보 · 유사도 · 문항 은행 (3 + 6)
-- ---------------------------------------------------------------------
create table exam_builds (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references profiles on delete cascade,
  title              text not null,
  source_mode        text not null check (source_mode in ('passage','past_items')),
  sim_mode           text not null default '신규' check (sim_mode in ('동형','선지변형','보기선지변형','재구성','신규')),
  struct_min         numeric(3,2),
  struct_max         numeric(3,2),
  surface_max        numeric(3,2),
  pair_surface_max   numeric(3,2) not null default 0.60,   -- 세트 안 두 문항 표현 유사도 상한
  pair_evidence_max  numeric(3,2) not null default 0.50,   -- 세트 안 근거 겹침 상한
  difficulty         text not null default 'HIGHEST' check (difficulty in ('SOURCE','MIDDLE','MEDIUM','HIGHEST')),
  rounds             smallint not null default 1 check (rounds between 1 and 20),
  answer_balance     boolean not null default true,
  analysis_id        uuid references exam_analyses on delete set null,
  design_preset_id   uuid,
  extra_instructions text check (char_length(extra_instructions) <= 20000),
  auto_confirm       boolean not null default true,
  status             text not null default 'draft' check (status in ('draft','planned','generating','review','confirmed')),
  created_at         timestamptz default now()
);

-- 모드별 유사도 목표 자동 입력 (원본 기출 대비)
create or replace function set_sim_targets() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.struct_min is null and new.struct_max is null and new.surface_max is null)
     or (tg_op = 'UPDATE' and new.sim_mode is distinct from old.sim_mode) then
    select t.smin, t.smax, t.surf into new.struct_min, new.struct_max, new.surface_max
    from (values ('동형',         0.70, 1.00, 0.35),
                 ('선지변형',     0.80, 1.00, 0.60),
                 ('보기선지변형', 0.60, 0.85, 0.45),
                 ('재구성',       0.40, 0.70, 0.30),
                 ('신규',         0.00, 0.50, 0.30)) as t(mode, smin, smax, surf)
    where t.mode = new.sim_mode;
  end if;
  return new;
end $$;

create trigger trg_sim_targets before insert or update on exam_builds
  for each row execute function set_sim_targets();

create table build_sources (
  build_id             uuid references exam_builds on delete cascade,
  ord                  int not null,
  passage_id           bigint references passages,
  source_item_id       bigint references items,      -- 공용 기출 문항
  source_analysis_item smallint,                     -- 시험지 분석 문항 번호 (exam_builds.analysis_id 기준)
  item_types           text[] not null default '{}',
  primary key (build_id, ord),
  check (passage_id is not null or source_item_id is not null or source_analysis_item is not null)
);

create table blueprint_slots (
  id            bigint generated always as identity primary key,
  build_id      uuid not null references exam_builds on delete cascade,
  round         smallint not null default 1,
  slot_no       smallint not null,
  source_ord    int,
  passage_id    bigint references passages,
  seg_ids       int[] not null default '{}',     -- 근거 범위
  item_type     text references item_types,
  judgment_axis text,                            -- 무엇을 판단하게 하는가
  trap_type     text,
  difficulty    text check (difficulty in ('하','중','상','최상')),
  target_answer smallint check (target_answer between 1 and 5),
  locked        boolean not null default false,
  status        text not null default 'planned'
                check (status in ('planned','generating','validating','review','accepted','failed')),
  unique (build_id, round, slot_no)
);

create table item_candidates (
  id                 bigint generated always as identity primary key,
  slot_id            bigint not null references blueprint_slots on delete cascade,
  version            smallint not null default 1,
  item               jsonb not null,      -- {stem, boogi, choices[5], answer, explanation, evidence_quotes[]}
  stem_skeleton      text,
  stem_embedding     vector(768),
  text_embedding     vector(768),
  choice_minhash     bigint[],
  evidence_seg_ids   int[] not null default '{}',
  sim_struct_source  numeric(4,3),
  sim_surface_source numeric(4,3),
  max_pair_surface   numeric(4,3),
  max_pair_evidence  numeric(4,3),
  max_bank_surface   numeric(4,3),
  nearest_bank_id    bigint,
  checks             jsonb,               -- {structure:[…], solver:{…}, evidence:{…}, length_bias, residue}
  solver_answer      smallint,
  status             text not null default 'draft'
                     check (status in ('draft','passed','flagged','accepted','rejected','replaced')),
  pencils            int not null default 0,
  created_at         timestamptz default now(),
  unique (slot_id, version)
);

create table bank_items (
  id                bigint generated always as identity primary key,
  owner_id          uuid not null references profiles on delete cascade,
  passage_id        bigint references passages on delete set null,
  passage_hash      text,
  item              jsonb not null,
  item_type         text references item_types,
  stem_skeleton     text,
  stem_embedding    vector(768),
  text_embedding    vector(768),
  choice_minhash    bigint[],
  evidence_seg_ids  int[] not null default '{}',
  from_candidate_id bigint references item_candidates on delete set null,
  used_count        int not null default 1,
  created_at        timestamptz default now()
);
create index on bank_items using hnsw (text_embedding vector_cosine_ops);
create index on bank_items using hnsw (stem_embedding vector_cosine_ops);
create index on bank_items (owner_id, passage_hash);
create index bank_items_skeleton_trgm on bank_items using gin (stem_skeleton gin_trgm_ops);

-- 유사도 함수 ---------------------------------------------------------
create or replace function minhash_jaccard(a bigint[], b bigint[]) returns numeric
language sql immutable as $$
  select case
    when a is null or b is null or cardinality(a) = 0 or cardinality(a) <> cardinality(b) then 0
    else round((select count(*) from generate_subscripts(a, 1) as i where a[i] = b[i])::numeric / cardinality(a), 3)
  end;
$$;

create or replace function jaccard_int(a int[], b int[]) returns numeric
language sql immutable as $$
  select case
    when coalesce(cardinality(a), 0) + coalesce(cardinality(b), 0) = 0 then 0
    else round((select count(*) from (select unnest(a) intersect select unnest(b)) x)::numeric
             / (select count(*) from (select unnest(a) union select unnest(b)) y), 3)
  end;
$$;

-- 구조 유사도: 같은 발문 유형 0.4 + 발문 뼈대 코사인 0.3 + 근거 겹침 0.3
create or replace function sim_struct(p_type_a text, p_type_b text, p_skel_a vector, p_skel_b vector, p_ev_a int[], p_ev_b int[])
returns numeric language sql immutable as $$
  select round((0.4 * (case when p_type_a = p_type_b then 1 else 0 end)
              + 0.3 * coalesce(1 - (p_skel_a <=> p_skel_b), 0)
              + 0.3 * jaccard_int(p_ev_a, p_ev_b))::numeric, 3);
$$;

-- 표현 유사도: max(본문 코사인, 선지 MinHash)
create or replace function sim_surface(p_text_a vector, p_text_b vector, p_mh_a bigint[], p_mh_b bigint[])
returns numeric language sql immutable as $$
  select round(greatest(coalesce(1 - (p_text_a <=> p_text_b), 0)::numeric, minhash_jaccard(p_mh_a, p_mh_b)), 3);
$$;

-- 과거 문항 중 가장 비슷한 것 (같은 지문 우선)
create or replace function similar_bank_items(p_passage_hash text, p_text vector, p_limit int default 5)
returns table (bank_id bigint, cosine numeric) language sql stable as $$
  select b.id, round((1 - (b.text_embedding <=> p_text))::numeric, 3)
  from bank_items b
  where b.owner_id = auth.uid()
    and (p_passage_hash is null or b.passage_hash = p_passage_hash)
    and b.text_embedding is not null
  order by b.text_embedding <=> p_text
  limit p_limit;
$$;

-- 정답 번호 계획: 1~5 고르게, 같은 번호 3연속 금지
create or replace function plan_answer_positions(p_n int, p_seed int default 0)
returns smallint[] language plpgsql volatile as $$
declare
  pool  smallint[] := '{}';
  res   smallint[] := '{}';
  i     int;
  k     int;
  pick  smallint;
  tries int;
  n     int;
begin
  for i in 0 .. p_n - 1 loop
    pool := pool || ((i % 5) + 1)::smallint;
  end loop;
  perform setseed(((p_seed % 1000) / 1000.0)::double precision);
  while cardinality(pool) > 0 loop
    tries := 0;
    loop
      k := 1 + floor(random() * cardinality(pool))::int;
      pick := pool[k];
      n := cardinality(res);
      exit when n < 2 or not (res[n] = pick and res[n - 1] = pick) or tries > 20;
      tries := tries + 1;
    end loop;
    res := res || pick;
    pool := pool[1 : k - 1] || pool[k + 1 : cardinality(pool)];
  end loop;
  return res;
end $$;

-- 후보 통과 여부 (검토 화면 배지와 자동 확정 기준)
create view v_candidate_gate with (security_invoker = true) as
select c.id as candidate_id, s.build_id, s.round, s.slot_no, c.version, c.status,
  c.sim_struct_source, c.sim_surface_source, c.max_pair_surface, c.max_pair_evidence, c.max_bank_surface,
  (c.sim_struct_source is null or c.sim_struct_source between b.struct_min and b.struct_max) as struct_ok,
  (c.sim_surface_source is null or c.sim_surface_source <= b.surface_max)                    as surface_ok,
  (coalesce(c.max_pair_surface, 0) <= b.pair_surface_max)                                    as pair_ok,
  (coalesce(c.max_pair_evidence, 0) <= b.pair_evidence_max)                                  as evidence_ok,
  (coalesce(c.max_bank_surface, 0) <= b.pair_surface_max)                                    as bank_ok,
  (s.target_answer is null or jsonb_typeof(c.item -> 'answer') <> 'number'
     or (c.item ->> 'answer')::int = s.target_answer)                                        as answer_pos_ok,
  (c.solver_answer is null or jsonb_typeof(c.item -> 'answer') <> 'number'
     or c.solver_answer = (c.item ->> 'answer')::int)                                        as solver_ok
from item_candidates c
join blueprint_slots s on s.id = c.slot_id
join exam_builds b on b.id = s.build_id;

-- ---------------------------------------------------------------------
-- 7. 디자인 작업대: 프리셋 · 배너 슬롯 · 버전 (8)
-- ---------------------------------------------------------------------
-- slots 예:
-- {"header":{"mode":"image","asset_id":"…","fit":"cover","focal":[0.5,0.4],"height_mm":22,
--            "opacity":1,"pages":"all","text_color":"auto"},
--  "cover":{"mode":"auto"}, "divider":{"mode":"none"}, "footer":{"mode":"text"}, "watermark":{"mode":"none"}}
create or replace function valid_design_slots(s jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
           e.k in ('cover','header','divider','footer','watermark','logo')
       and jsonb_typeof(e.v) = 'object'
       and coalesce(e.v ->> 'mode', 'auto')  in ('auto','image','library','text','none')
       and coalesce(e.v ->> 'fit', 'cover')  in ('cover','contain','stretch')
       and coalesce(e.v ->> 'pages', 'all')  in ('all','first','odd','even','none')
       and (coalesce(e.v ->> 'mode', 'auto') not in ('image','library') or e.v ? 'asset_id')
       and coalesce((e.v ->> 'height_mm')::numeric, 20) between 0 and 120
       and coalesce((e.v ->> 'opacity')::numeric, 1) between 0 and 1
         ), true)
  from jsonb_each(coalesce(s, '{}'::jsonb)) as e(k, v);
$$;

create table design_presets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles on delete cascade,
  name          text not null,
  is_default    boolean not null default false,
  target        text not null default 'exam' check (target in ('exam','textbook','annotation')),
  output_format text not null default 'hwpx' check (output_format in ('hwpx','pdf')),
  paper         text not null default 'B4' check (paper in ('A4','B4')),
  orientation   text not null default 'portrait' check (orientation in ('portrait','landscape')),
  page_frame    text not null default 'mock-exam',
  tokens        jsonb not null default '{}',   -- {fontFamily, bodyPt, lineSpacing, accent, margins:{t,b,l,r}, columns}
  slots         jsonb not null default '{}' check (valid_design_slots(slots)),
  branding      jsonb not null default '{}',   -- {academyName, headerText, footerText, logoAssetId, showPageNumbers}
  apply_mode    text not null default 'preset' check (apply_mode in ('preset','prompt')),
  version       int not null default 1,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create unique index design_presets_one_default on design_presets (owner_id, target) where is_default;

create table design_preset_versions (
  preset_id  uuid references design_presets on delete cascade,
  version    int not null,
  snapshot   jsonb not null,
  created_at timestamptz default now(),
  primary key (preset_id, version)
);

create or replace function snapshot_design_preset() returns trigger language plpgsql as $$
begin
  insert into design_preset_versions (preset_id, version, snapshot)
  values (old.id, old.version, to_jsonb(old))
  on conflict do nothing;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_preset_version before update on design_presets
  for each row
  when (old.tokens is distinct from new.tokens or old.slots is distinct from new.slots
        or old.branding is distinct from new.branding or old.page_frame is distinct from new.page_frame
        or old.paper is distinct from new.paper or old.orientation is distinct from new.orientation)
  execute function snapshot_design_preset();

alter table textbooks   add constraint textbooks_preset_fk   foreign key (design_preset_id) references design_presets on delete set null;
alter table exam_builds add constraint exam_builds_preset_fk foreign key (design_preset_id) references design_presets on delete set null;

-- ---------------------------------------------------------------------
-- 8. 설정 (11): 한 행에 모으고 변경 이력 보관
-- ---------------------------------------------------------------------
create table teacher_settings (
  owner_id            uuid primary key references profiles on delete cascade,
  output_defaults     jsonb not null default '{"quickAnswers":false,"promptTitles":true,"answerPlacement":"inline-endnote"}',
  annotation_defaults jsonb not null default '{"density":3,"autoHighlight":true,"excludeQuestions":true,"layout":"wing"}',
  ocr_chain           text[] not null default array['gemini','reference_mode','qwen_vl','tile_mode','dedicated_ocr','rule_based','manual'],
  style_memory        jsonb not null default '{}',   -- 선호 용어, 금지 표현 (주석 생성에 반영)
  notify              jsonb not null default '{}',
  ui                  jsonb not null default '{"theme":"system","accent":"#904AE8"}',
  updated_at          timestamptz default now()
);

create table settings_history (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references profiles on delete cascade,
  changed_at timestamptz default now(),
  diff       jsonb not null
);

create or replace function log_settings_change() returns trigger language plpgsql as $$
declare d jsonb;
begin
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
    into d
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value and n.key <> 'updated_at';
  if d <> '{}'::jsonb then
    insert into settings_history (owner_id, diff) values (new.owner_id, d);
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_settings_history before update on teacher_settings
  for each row execute function log_settings_change();

-- ---------------------------------------------------------------------
-- 9. 보안 (RLS): 전부 본인 소유 데이터만
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assets','documents','exam_analyses','annotation_sets','passage_schemas','textbooks',
                           'exam_builds','bank_items','design_presets','teacher_settings','webhooks','agent_routines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own" on %I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- 서버(service role)만 쓰는 테이블: 사용자는 읽기만
alter table jobs             enable row level security;
alter table pencil_ledger    enable row level security;
alter table settings_history enable row level security;
alter table api_keys         enable row level security;
create policy "own read"   on jobs             for select to authenticated using (owner_id = auth.uid());
create policy "own create" on jobs             for insert to authenticated
  with check (owner_id = auth.uid() and charged_pencils = 0 and status in ('quoted','queued'));
create policy "own read"   on pencil_ledger    for select to authenticated using (owner_id = auth.uid());
create policy "own read"   on settings_history for select to authenticated using (owner_id = auth.uid());
create policy "own read"   on api_keys         for select to authenticated using (owner_id = auth.uid());
create policy "own revoke" on api_keys         for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 하위 테이블: 부모 소유자 기준
alter table job_events             enable row level security;
alter table ocr_attempts           enable row level security;
alter table document_pages         enable row level security;
alter table ocr_lines              enable row level security;
alter table analysis_items         enable row level security;
alter table annotations            enable row level security;
alter table attachment_alignments  enable row level security;
alter table textbook_units         enable row level security;
alter table textbook_attachments   enable row level security;
alter table build_sources          enable row level security;
alter table blueprint_slots        enable row level security;
alter table item_candidates        enable row level security;
alter table design_preset_versions enable row level security;
alter table passage_segments       enable row level security;

create policy "via job" on job_events for select to authenticated
  using (exists (select 1 from jobs j where j.id = job_events.job_id and j.owner_id = auth.uid()));
create policy "via job" on ocr_attempts for select to authenticated
  using (exists (select 1 from jobs j where j.id = ocr_attempts.job_id and j.owner_id = auth.uid()));

create policy "via doc" on document_pages for all to authenticated
  using (exists (select 1 from documents d where d.id = document_pages.document_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from documents d where d.id = document_pages.document_id and d.owner_id = auth.uid()));
create policy "via doc" on ocr_lines for all to authenticated
  using (exists (select 1 from documents d where d.id = ocr_lines.document_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from documents d where d.id = ocr_lines.document_id and d.owner_id = auth.uid()));
create policy "via doc" on attachment_alignments for all to authenticated
  using (exists (select 1 from documents d where d.id = attachment_alignments.document_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from documents d where d.id = attachment_alignments.document_id and d.owner_id = auth.uid()));

create policy "via analysis" on analysis_items for all to authenticated
  using (exists (select 1 from exam_analyses a where a.id = analysis_items.analysis_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from exam_analyses a where a.id = analysis_items.analysis_id and a.owner_id = auth.uid()));

create policy "via set" on annotations for all to authenticated
  using (exists (select 1 from annotation_sets s where s.id = annotations.set_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from annotation_sets s where s.id = annotations.set_id and s.owner_id = auth.uid()));

create policy "via textbook" on textbook_units for all to authenticated
  using (exists (select 1 from textbooks t where t.id = textbook_units.textbook_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from textbooks t where t.id = textbook_units.textbook_id and t.owner_id = auth.uid()));
create policy "via textbook" on textbook_attachments for all to authenticated
  using (exists (select 1 from textbooks t where t.id = textbook_attachments.textbook_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from textbooks t where t.id = textbook_attachments.textbook_id and t.owner_id = auth.uid()));

create policy "via build" on build_sources for all to authenticated
  using (exists (select 1 from exam_builds b where b.id = build_sources.build_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from exam_builds b where b.id = build_sources.build_id and b.owner_id = auth.uid()));
create policy "via build" on blueprint_slots for all to authenticated
  using (exists (select 1 from exam_builds b where b.id = blueprint_slots.build_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from exam_builds b where b.id = blueprint_slots.build_id and b.owner_id = auth.uid()));
create policy "via slot" on item_candidates for all to authenticated
  using (exists (select 1 from blueprint_slots s join exam_builds b on b.id = s.build_id
                 where s.id = item_candidates.slot_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from blueprint_slots s join exam_builds b on b.id = s.build_id
                      where s.id = item_candidates.slot_id and b.owner_id = auth.uid()));

create policy "via preset" on design_preset_versions for all to authenticated
  using (exists (select 1 from design_presets p where p.id = design_preset_versions.preset_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from design_presets p where p.id = design_preset_versions.preset_id and p.owner_id = auth.uid()));

create policy "via passage read" on passage_segments for select to authenticated
  using (exists (select 1 from passages p where p.id = passage_segments.passage_id));
create policy "via passage write" on passage_segments for all to authenticated
  using (exists (select 1 from passages p where p.id = passage_segments.passage_id
                 and (p.owner_id = auth.uid() or (p.owner_id is null and is_admin()))))
  with check (exists (select 1 from passages p where p.id = passage_segments.passage_id
                      and (p.owner_id = auth.uid() or (p.owner_id is null and is_admin()))));
