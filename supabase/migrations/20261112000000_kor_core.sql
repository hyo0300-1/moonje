-- =====================================================================
-- 비해당학원 국어 전용 스키마 v1.1  (Supabase / PostgreSQL 15+)
-- v1.1: 학급 운영(학생·학부모·반·응시·응답, 학생 분석 뷰) 제거, 강사 전용
-- 위치: supabase/migrations/20261112000000_kor_core.sql
-- 적용: supabase db push  또는  SQL Editor에 통째로 붙여넣기
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 기본 타입
-- ---------------------------------------------------------------------
create type grade_level as enum ('중1','중2','중3','고1','고2','고3','N수');

-- ---------------------------------------------------------------------
-- 1. 국어 분류 체계 (영역 > 갈래/제재 > 세부)
--    id 규칙: 'LIT' / 'LIT.MPO' / 'LAM.GRM.PHO'
-- ---------------------------------------------------------------------
create table taxonomy (
  id        text primary key,
  parent_id text references taxonomy,
  level     smallint not null check (level between 1 and 3),
  name      text not null,
  sort      int default 0
);

insert into taxonomy (id, parent_id, level, name, sort) values
  ('READ',        null,      1, '독서', 1),
  ('READ.HUM',    'READ',    2, '인문', 1),
  ('READ.SOC',    'READ',    2, '사회', 2),
  ('READ.SCI',    'READ',    2, '과학', 3),
  ('READ.TEC',    'READ',    2, '기술', 4),
  ('READ.ART',    'READ',    2, '예술', 5),
  ('READ.MIX',    'READ',    2, '주제통합', 6),
  ('READ.MTH',    'READ',    2, '독서 이론', 7),
  ('LIT',         null,      1, '문학', 2),
  ('LIT.MPO',     'LIT',     2, '현대시', 1),
  ('LIT.MNO',     'LIT',     2, '현대소설', 2),
  ('LIT.CPO',     'LIT',     2, '고전시가', 3),
  ('LIT.CNO',     'LIT',     2, '고전소설', 4),
  ('LIT.DRA',     'LIT',     2, '극·시나리오', 5),
  ('LIT.ESS',     'LIT',     2, '수필', 6),
  ('LIT.MIX',     'LIT',     2, '복합 갈래', 7),
  ('SPW',         null,      1, '화법과 작문', 3),
  ('SPW.SPK',     'SPW',     2, '화법', 1),
  ('SPW.WRT',     'SPW',     2, '작문', 2),
  ('SPW.MIX',     'SPW',     2, '화법·작문 통합', 3),
  ('LAM',         null,      1, '언어와 매체', 4),
  ('LAM.GRM',     'LAM',     2, '문법', 1),
  ('LAM.GRM.PHO', 'LAM.GRM', 3, '음운', 1),
  ('LAM.GRM.MOR', 'LAM.GRM', 3, '단어·형태소', 2),
  ('LAM.GRM.SYN', 'LAM.GRM', 3, '문장', 3),
  ('LAM.GRM.DIS', 'LAM.GRM', 3, '담화·의미', 4),
  ('LAM.GRM.HIS', 'LAM.GRM', 3, '국어사', 5),
  ('LAM.GRM.NRM', 'LAM.GRM', 3, '어문 규범', 6),
  ('LAM.MED',     'LAM',     2, '매체', 2);

-- 발문(문항) 유형
create table item_types (
  code        text primary key,
  name        text not null,
  description text
);

insert into item_types (code, name, description) values
  ('FACT',    '내용 일치',        '지문 정보와 선지의 일치 여부'),
  ('INFER',   '세부 추론',        '지문에 직접 없는 내용을 근거로 추론'),
  ('APPLY',   '<보기> 적용',      '<보기> 사례·관점을 지문에 적용'),
  ('VOCAB',   '어휘·문맥적 의미', '사전적·문맥적 의미, 바꿔 쓰기'),
  ('STRUCT',  '서술 방식·전개',   '글의 전개 방식, 서술상 특징'),
  ('EXPR',    '표현상 특징',      '문학 표현법, 시어·소재의 기능'),
  ('CHAR',    '인물·심리·상황',   '인물의 태도, 심리, 사건 파악'),
  ('COMPARE', '작품·관점 비교',   '(가)(나) 비교, 관점 대비'),
  ('CRIT',    '비판·평가',        '반응의 적절성, 비판적 읽기'),
  ('GRAM',    '문법 탐구',        '문법 개념 적용과 자료 탐구'),
  ('MEDIA',   '매체 자료',        '매체 특성, 자료 활용'),
  ('SPEECH',  '화법 전략',        '말하기 전략, 청중 고려'),
  ('WRITE',   '작문 계획·고쳐쓰기','글쓰기 계획, 자료 활용, 고쳐쓰기');

-- 개념 카드 (문학 개념의 끝, 문법 개념의 끝 강좌와 연결)
create table concepts (
  id          bigint generated always as identity primary key,
  taxonomy_id text references taxonomy,
  kind        text not null check (kind in ('문학개념어','문법개념','독서배경지식','화작개념','매체개념')),
  name        text not null unique,
  definition  text,
  example     text
);

-- ---------------------------------------------------------------------
-- 2. 작품 · 지문 (10종 문학 교과서 수록 정보 포함)
-- ---------------------------------------------------------------------
create table works (
  id          bigint generated always as identity primary key,
  title       text not null,
  author      text,
  era         text check (era in ('고전','현대')),
  taxonomy_id text references taxonomy,
  unique (title, author)
);

create table work_textbooks (
  work_id   bigint references works on delete cascade,
  publisher text not null,          -- 예: 천재(김), 미래엔, 비상 ...
  subject   text not null,          -- 문학, 국어, 중1 국어 ...
  primary key (work_id, publisher, subject)
);

create table passages (
  id          bigint generated always as identity primary key,
  taxonomy_id text not null references taxonomy,
  work_id     bigint references works,
  title       text,
  body        text,
  char_count  int generated always as (char_length(body)) stored,
  source      text
);

-- ---------------------------------------------------------------------
-- 3. 시험 · 문항 · 선지
-- ---------------------------------------------------------------------
create table exams (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('수능','평가원모평','교육청학평','EBS','사설','내신','자체')),
  exam_date    date,
  grade        grade_level,
  title        text not null,
  ebsi_irecord text unique            -- 예: 202511133 (2025.11.13 고3 수능)
);

create table items (
  id           bigint generated always as identity primary key,
  exam_id      bigint references exams on delete cascade,
  number       smallint not null,
  elective     text not null default '공통' check (elective in ('공통','화작','언매')),
  passage_id   bigint references passages,
  taxonomy_id  text references taxonomy,
  item_type    text references item_types,
  points       smallint default 2,
  answer       smallint check (answer between 1 and 5),
  stem         text,
  ebsi_item_id text,
  unique (exam_id, number, elective)
);

-- 선지별 함정 유형: 오답 원인을 '왜 이 선지에 끌렸는가'로 분류
create table item_choices (
  item_id     bigint references items on delete cascade,
  no          smallint check (no between 1 and 5),
  body        text,
  trap_type   text check (trap_type in ('부분일치','범위확대·축소','인과전도','주체혼동','개념혼동','보기오적용','근거없음','어휘착각')),
  explanation text,
  primary key (item_id, no)
);

create table item_concepts (
  item_id    bigint references items on delete cascade,
  concept_id bigint references concepts on delete cascade,
  primary key (item_id, concept_id)
);

-- 전국 통계 (EBSi). 공통 문항도 선택과목 집단별로 따로 집계됨
create table national_item_stats (
  item_id      bigint references items on delete cascade,
  elective     text not null check (elective in ('화작','언매')),
  wrong_rate   numeric(5,2),
  rank_in_exam smallint,
  r1 numeric(5,2), r2 numeric(5,2), r3 numeric(5,2), r4 numeric(5,2), r5 numeric(5,2),
  source       text default 'EBSi',
  collected_at date default current_date,
  primary key (item_id, elective)
);

-- 등급컷 (원점수 기준)
create table exam_grade_cuts (
  exam_id  bigint references exams on delete cascade,
  elective text not null check (elective in ('화작','언매')),
  grade    smallint check (grade between 1 and 8),
  raw_cut  smallint,
  std_cut  smallint,
  primary key (exam_id, elective, grade)
);

-- ---------------------------------------------------------------------
-- 4. 계정 (강사 전용 앱: 학생·학부모·반·응시 테이블 없음)
-- ---------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  name         text not null,
  role         text not null default 'teacher' check (role in ('admin','teacher')),
  academy_name text,
  phone        text,
  created_at   timestamptz default now()
);

create index on items (exam_id);
create index on items (passage_id);

-- ---------------------------------------------------------------------
-- 6. 분석 뷰 (전국 통계 기반, 시험지 제작 설계도의 난도 근거)
-- ---------------------------------------------------------------------

-- 6-1. 전국 기준 우선순위 (Data Studio와 같은 규칙)
create view v_national_priority with (security_invoker = true) as
with base as (
  select x.*, i.exam_id, i.number, i.taxonomy_id, i.item_type, i.answer, t.trap_choice, t.trap_rate
  from national_item_stats x
  join items i on i.id = x.item_id
  left join lateral (
    select u.k::smallint as trap_choice, u.v as trap_rate
    from unnest(array[x.r1, x.r2, x.r3, x.r4, x.r5]) with ordinality as u(v, k)
    where u.k <> i.answer
    order by u.v desc nulls last
    limit 1
  ) t on true
)
select *,
  case when wrong_rate > 0 and trap_rate >= wrong_rate / 2 then '함정형' else '분산형' end as trap_kind,
  case when wrong_rate >= 60 then '집중지도' when wrong_rate >= 45 then '핵심정리' else '요점전달' end as tier,
  case when wrong_rate >= 60 then 15 when wrong_rate >= 45 then 7 else 2 end as minutes
from base;

-- ---------------------------------------------------------------------
-- 7. 보안 (RLS)
-- ---------------------------------------------------------------------
create or replace function is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','teacher'));
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- 공용 국어 데이터: 로그인 사용자 읽기, 관리자만 쓰기
do $$
declare t text;
begin
  foreach t in array array['taxonomy','item_types','concepts','works','work_textbooks','passages',
                           'exams','items','item_choices','item_concepts','national_item_stats',
                           'exam_grade_cuts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select to authenticated using (true)', t);
    execute format('create policy "admin write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "profile self" on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy "profile self update" on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
create policy "profile admin insert" on profiles for insert to authenticated with check (is_admin() or id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. EBSi 오답률 CSV 가져오기
--    (1) Table Editor > stg_ebsi > Import data from CSV 로 기존 CSV를 그대로 업로드
--        (헤더가 CSV와 똑같이 맞춰져 있음)
--    (2) SQL Editor에서  select import_ebsi();
-- ---------------------------------------------------------------------
create table stg_ebsi (
  "시행연도" int, "학년도" text, "시험일" text, "시험구분" text, "선택과목" text,
  "오답률순위" int, "문항번호" int, "영역" text, "오답률(%)" numeric, "배점" int, "정답" text,
  "정답률(%)" numeric, "①(%)" numeric, "②(%)" numeric, "③(%)" numeric, "④(%)" numeric, "⑤(%)" numeric,
  "최다오답선지" text, "최다오답비율(%)" numeric, "EBSi_irecord" text, "EBSi_itemId" text
);
alter table stg_ebsi enable row level security;
create policy "admin only" on stg_ebsi for all to authenticated using (is_admin()) with check (is_admin());

create view v_stg_ebsi with (security_invoker = true) as
select s.*,
  case s."선택과목" when '화법과 작문' then '화작' else '언매' end as el_group,
  case when s."문항번호" <= 34 then '공통'
       when s."선택과목" = '화법과 작문' then '화작' else '언매' end as item_el,
  case when s."영역" like '%독서%' then 'READ'
       when s."영역" like '%문학%' then 'LIT'
       when s."영역" like '%화법%' or s."영역" like '%작문%' then 'SPW'
       when s."영역" like '%언어%' or s."영역" like '%매체%' or s."영역" like '%문법%' then 'LAM' end as tax,
  strpos('①②③④⑤', s."정답")::smallint as answer_no
from stg_ebsi s;

create or replace function import_ebsi() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into exams (kind, exam_date, grade, title, ebsi_irecord)
  select distinct on (v."EBSi_irecord")
    case when v."시험구분" like '%수능%' or v."시험구분" like '%수학능력%' or v."시험일" like '%수능%' then '수능'
         when v."시험구분" like '%평가원%' or v."시험구분" like '%모의평가%' then '평가원모평'
         else '교육청학평' end,
    to_date(left(v."EBSi_irecord", 8), 'YYYYMMDD'),
    ('고' || right(v."EBSi_irecord", 1))::grade_level,
    v."시행연도" || ' ' || v."시험일",
    v."EBSi_irecord"
  from v_stg_ebsi v
  on conflict (ebsi_irecord) do nothing;

  insert into items (exam_id, number, elective, taxonomy_id, points, answer, ebsi_item_id)
  select distinct on (e.id, v."문항번호", v.item_el)
    e.id, v."문항번호", v.item_el, v.tax, v."배점", v.answer_no, v."EBSi_itemId"
  from v_stg_ebsi v
  join exams e on e.ebsi_irecord = v."EBSi_irecord"
  on conflict (exam_id, number, elective) do update
    set answer      = excluded.answer,
        points      = excluded.points,
        taxonomy_id = coalesce(items.taxonomy_id, excluded.taxonomy_id),
        ebsi_item_id = coalesce(items.ebsi_item_id, excluded.ebsi_item_id);

  insert into national_item_stats (item_id, elective, wrong_rate, rank_in_exam, r1, r2, r3, r4, r5)
  select i.id, v.el_group, v."오답률(%)", v."오답률순위",
         v."①(%)", v."②(%)", v."③(%)", v."④(%)", v."⑤(%)"
  from v_stg_ebsi v
  join exams e on e.ebsi_irecord = v."EBSi_irecord"
  join items i on i.exam_id = e.id and i.number = v."문항번호" and i.elective = v.item_el
  on conflict (item_id, elective) do update
    set wrong_rate = excluded.wrong_rate, rank_in_exam = excluded.rank_in_exam,
        r1 = excluded.r1, r2 = excluded.r2, r3 = excluded.r3, r4 = excluded.r4, r5 = excluded.r5,
        collected_at = current_date;
  get diagnostics n = row_count;
  return n;
end $$;
