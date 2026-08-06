# Yong Ho's Workspace (yongho-s-repository)

직업훈련 정보 수집·분석용 정적 웹앱 + Vercel 서버리스 API.
`analysis-notion` 워크스페이스 안에서 관리되지만, 메인 수집 파이프라인(`analysis-notion/skills/`, `run-analysis.js` 등)과는 **별개의 독립 배포 프로젝트**다.

## 배포

- GitHub: https://github.com/2ndnameian/Yongho-s-repository
- Vercel: https://yongho-s-repository-git-main-2ndnameians-projects.vercel.app/
- `main` 브랜치 push → Vercel 자동 배포(Production)

## 이 폴더가 유일한 작업 위치

이전에는 `analysis-notion/_archive/수집코드_구버전/claude버전/`에도 같은 저장소의 미완성 클론이 남아있었으나(2026-08-05 확인 결과 커밋 이력 없이 방치된 상태, origin과 내용도 동일), 혼선을 막기 위해 정리했다.
**이 프로젝트를 이어서 개발할 때는 이 폴더(`yongho-repo/`)만 사용한다.**

## 구조

```
pages/                    모든 .html 페이지가 모여있는 폴더 (2026-08-06 정리)
  index.html                메인 진입 페이지 (뉴스/정책/시장/경쟁/종합분석 메뉴)
  news.html / policy.html / market.html / competitor.html / analysis.html
  training_dashboard.html   훈련 대시보드
  claude_guide.html         "Claude 조사 도우미" 페이지. Claude 조사 지시문 생성,
                             JSON 양식 복사, Notion 필드 매핑표, 결과 JSON 검증까지
                             갖춘 완성된 클라이언트 사이드 도구(API 의존성 없음).
  logs.html                 실행 로그 조회 페이지 (수동 저장·자동 수집 이력)
  ※ URL은 그대로 유지됨 — vercel.json의 rewrites가 /news.html 등 기존 경로를
    /pages/news.html로 투명하게 연결. 북마크·nav 링크 수정 불필요.
api/
  news.js             네이버 뉴스 검색 (NAVER_CLIENT_ID/SECRET 필요). competitor.html도 이 API를 재사용.
  policy.js           정책/공모사업 수집 (RSS 기반, category 파라미터로 필터)
  market.js           시장동향 수집 (category 파라미터에 기본 키워드 내장)
  analyze.js          수집 결과 종합분석
  save-snapshot.js    수집 결과를 Vercel Blob(Private)에 일별 스냅샷으로 저장 (POST). 저장 시 실행 로그도 함께 기록.
  snapshot.js         저장된 스냅샷 조회 (GET, ?source=&date=)
  auto-collect.js     매주 자동 수집 → save-snapshot 저장까지 서버에서 재현 (2026-08-06 추가)
  cleanup-snapshots.js 1년 지난 일별 스냅샷 자동 삭제 (2026-08-06 추가)
  logs.js             실행 로그 조회 (GET)
  _lib/log.js         실행 로그 append 헬퍼 (save-snapshot.js가 사용)
vercel.json      rewrites(pages/ 폴더 URL 매핑) + crons(주간 자동 수집 + 월간 정리) 설정. api/auto-collect.js는 maxDuration:60.
package.json     @vercel/blob(2.6.1) 의존성 포함
```

## 개선 작업 계획 (2026-08-05 논의)

### 배경 · 작업지시의 의미

사용자가 "이 앱을 조금 더 개발하고 싶다"고 요청한 배경은, 지금 이 앱이 **매번 사람이 버튼을 눌러야 조회되고 결과가 저장되지 않는 즉석 조회 도구**에 머물러 있기 때문이다.
참고 삼아 유사 목적의 다른 저장소(`Snowball-Impact/smartHRD` — Python ETL 기반 CSV Warehouse + Power BI 대시보드)를 검토했고, 스택은 다르지만 **"수집 결과를 쌓아두고, 자동으로 갱신하고, 변경분만 알려주는" 운영 패턴**이 지금 이 앱에 빠져 있다는 점을 확인했다. 아래 항목들은 그 패턴을 이 앱(Vercel 서버리스 + 정적 HTML)에 맞게 옮겨온 것이다.

### 개선 범위 (우선순위순)

1. **수집 결과 영속 저장** — ✅ 완료(2026-08-05 구현, 2026-08-06 Blob Storage 실제 연결·검증 완료). Vercel Blob(**Private** 스토어)로 결정. `api/save-snapshot.js`가 `snapshots/{source}/{YYYY-MM-DD}.json`와 `snapshots/{source}/latest.json` 두 곳에 씀. `api/snapshot.js`로 조회(`?source=news&date=...`, date 생략 시 최신). news/policy/market/competitor.html에 기존 "💾 json 파일 생성"(로컬 다운로드) 버튼은 그대로 두고 "☁️ 서버에 저장" 버튼을 추가로 붙임(Fix-Only 원칙 — 기존 로컬 저장 로직은 건드리지 않음).
   Private 스토어라 `@vercel/blob`을 OIDC 인증을 지원하는 `2.6.1`로 올렸고, `put`/`get`을 `access:"private"`로 맞춰서 4개 소스 모두 저장·조회 실동작 확인함.
2. **변경 감지(diff) 알림** — ✅ 완료(2026-08-06). 각 수집 실행 전에 마지막 저장 스냅샷을 조회해 없던 항목을 `isNew`로 표시. news/policy/market/competitor.html 카드에 "🆕 NEW" 배지, 통계 줄에 "신규" 카운트 추가.
3. **자동 정기 수집** — ✅ 완료(2026-08-06). `api/auto-collect.js`가 브라우저 수집·가공 로직을 서버에서 재현해 4개 소스를 모두 수집 후 `save-snapshot`으로 저장. `vercel.json` crons에 `0 16 * * 5`(매주 금 16:00 UTC = **토 01:00 KST**) 등록, `CRON_SECRET`으로 보호. 실제 실행 검증 완료.
4. **실행 로그** — ✅ 완료(2026-08-06). `api/_lib/log.js`가 `save-snapshot.js` 저장 시마다(수동/자동 공통) `logs/execution-log.json`에 append(최근 200건 보관). `api/logs.js`로 조회, `logs.html`에서 시각·소스·트리거·건수·성공여부 표로 확인. (주의: 여러 소스를 동시에 저장하면 read-modify-write 경합으로 로그 유실 가능 — `auto-collect.js`는 이 때문에 순차 저장으로 처리함. 향후 다른 곳에서 병렬 저장을 추가할 경우 같은 이슈에 유의할 것.)
5. **(장기, 보류) work24/HRD-Net 공식 통계 연동** — 2026-08-06 검토 결과, 별도 프로젝트 `D:\vocational-training\고용24_크롤링`(work24 API키 보유, 경쟁기관 운영현황·매출을 엑셀 보고서로 생성하는 완성된 Python 도구)이 이미 존재함을 확인. `Snowball-Impact/smartHRD`(GitHub)의 work24 Open API 호출 방식(`authKey`+`returnType=json`+페이지네이션, 훈련유형별 별도 인증키)도 참고 확인함. **다음 세션에 재개 시 아래 방향 중 선택**:
   - (a, 추천) competitor.html에 엑셀 업로드 기능 추가 — `training_dashboard.html`의 xlsx 업로드 패턴을 재사용해, 고용24_크롤링 산출물을 뉴스 기반 경쟁기관 레이더 위에 실제 운영수치로 얹음. API 키 불필요, 코드 작업만.
   - (b) `competitor-stats.html` 같은 별도 페이지로 분리
   - (c) 기타 — 사용자 재검토 후 결정
   Fix-Only 전역 원칙상 `고용24_크롤링`의 `.py` 코드는 수정하지 않고 산출물(엑셀)만 소비하는 방향이 기본 전제.
6. **문서화** — 이 README를 진행 상황 갱신 창구로 계속 사용 중(2026-08-05, 2026-08-06 갱신).

### 추천 작업 방식

- **GSD 워크플로 적용 추천** — 이 프로젝트는 세션 사이에 맥락이 자주 끊기는 문제를 이미 겪었다(2026-08-05, "대화내역 복원해줄래" 요청으로 시작된 세션). 여러 기능이 순차적으로 엮여 있어(저장 → 변경감지 → 자동수집이 서로 의존) phase 단위 계획·진행상황을 파일로 남기는 GSD가 대화형 진행보다 다음 세션 인계에 유리하다.
- **별도 세션(워크스페이스) 권장** — 이 폴더(`analysis-notion/yongho-repo/`)를 cwd로 하는 새 세션에서 진행할 것. `training_curriculum_judge` 세션에 이 프로젝트의 메모리·계획이 섞이는 걸 방지하기 위함.

개발 발견 히스토리(GitHub/Vercel 연결관계 추적, 옛 클론 정리 경위)는 2026-08-05 세션, Blob Storage 연결·자동 수집·실행 로그 구현 경위는 2026-08-06 세션 대화 기록 참조.
