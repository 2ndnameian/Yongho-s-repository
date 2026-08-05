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
index.html                메인 진입 페이지 (뉴스/정책/시장/경쟁/종합분석 메뉴)
news.html / policy.html / market.html / competitor.html / analysis.html
training_dashboard.html   훈련 대시보드
claude_guide.html         "Claude 조사 도우미" 페이지. Claude 조사 지시문 생성,
                           JSON 양식 복사, Notion 필드 매핑표, 결과 JSON 검증까지
                           갖춘 완성된 클라이언트 사이드 도구(API 의존성 없음).
                           2026-08-05: news/policy/market/competitor/analysis.html
                           5개 페이지 nav에 링크를 추가해 정식 통합함.
api/
  news.js        네이버 뉴스 검색 (NAVER_CLIENT_ID/SECRET 필요)
  policy.js      정책/공모사업 수집
  market.js      시장동향 수집
  competitor.js  경쟁기관 수집
  analyze.js     수집 결과 종합분석
vercel.json      api/analyze.js 런타임 지정
package.json
```

## 개선 작업 계획 (2026-08-05 논의)

### 배경 · 작업지시의 의미

사용자가 "이 앱을 조금 더 개발하고 싶다"고 요청한 배경은, 지금 이 앱이 **매번 사람이 버튼을 눌러야 조회되고 결과가 저장되지 않는 즉석 조회 도구**에 머물러 있기 때문이다.
참고 삼아 유사 목적의 다른 저장소(`Snowball-Impact/smartHRD` — Python ETL 기반 CSV Warehouse + Power BI 대시보드)를 검토했고, 스택은 다르지만 **"수집 결과를 쌓아두고, 자동으로 갱신하고, 변경분만 알려주는" 운영 패턴**이 지금 이 앱에 빠져 있다는 점을 확인했다. 아래 항목들은 그 패턴을 이 앱(Vercel 서버리스 + 정적 HTML)에 맞게 옮겨온 것이다.

### 개선 범위 (우선순위순)

1. **수집 결과 영속 저장** — 지금은 새로고침하면 결과가 사라짐. Vercel은 서버리스라 로컬 파일에 못 쓰므로, Vercel KV/Blob Storage 또는 GitHub API로 이 저장소에 직접 커밋하는 방식으로 일별 스냅샷을 쌓는다.
2. **변경 감지(diff) 알림** — 매번 전체 재조회 결과를 다 보여주지 말고, 어제 대비 새로 뜬 항목만 하이라이트. smartHRD의 checksum 비교 로직과 동일한 아이디어.
3. **자동 정기 수집** — 지금은 사람이 버튼을 눌러야 수집됨. `vercel.json`의 `crons` 필드로 매일 아침 자동 수집 → 1번 저장까지 연결하면 "출근하면 이미 정리돼 있는" 형태가 됨.
4. **실행 로그** — 언제 몇 건 수집됐는지, API 실패는 없었는지 기록. 지금은 실패해도 콘솔에만 찍히고 흔적이 안 남음.
5. **(장기) work24/HRD-Net 공식 통계 연동** — `smartHRD`가 이미 고용24 API를 안정적으로 수집하는 로직을 갖고 있으므로, 추후 두 프로젝트를 연동해(smartHRD의 integrated CSV를 이 앱이 읽어오는 식) 뉴스·정책 정성 정보와 공식 통계 정량 정보를 한 화면에 합치는 것도 검토 가능.
6. **문서화** — 이 README 외에 `BACKLOG.md` 정도만 추가해도 재작업 시 맥락 파악에 도움이 됨.

### 추천 작업 방식

- **GSD 워크플로 적용 추천** — 이 프로젝트는 세션 사이에 맥락이 자주 끊기는 문제를 이미 겪었다(2026-08-05, "대화내역 복원해줄래" 요청으로 시작된 세션). 여러 기능이 순차적으로 엮여 있어(저장 → 변경감지 → 자동수집이 서로 의존) phase 단위 계획·진행상황을 파일로 남기는 GSD가 대화형 진행보다 다음 세션 인계에 유리하다.
- **별도 세션(워크스페이스) 권장** — 이 폴더(`analysis-notion/yongho-repo/`)를 cwd로 하는 새 세션에서 진행할 것. `training_curriculum_judge` 세션에 이 프로젝트의 메모리·계획이 섞이는 걸 방지하기 위함.

개발 발견 히스토리(GitHub/Vercel 연결관계 추적, 옛 클론 정리 경위)는 2026-08-05 세션 대화 기록 참조.
