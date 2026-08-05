# ONEUL WEATHER

지도 기반으로 전국 지역의 현재 날씨를 확인하고, 관심 지역의 현장 느낌을 커뮤니티에 남길 수 있는 Vue 3 날씨 앱입니다.

## 프로젝트 개요

- 지역 선택: 지도와 검색을 통해 시·도/구역을 선택
- 실시간 날씨: OpenWeather API와 기상청 초단기예보 데이터를 조합해 현재 기온, 체감온도, 습도, 바람 등 표시
- 커뮤니티: 선택한 지역에 대한 짧은 날씨 이야기 작성·수정·삭제
- 최근/즐겨찾기: 자주 본 지역을 저장하고 빠르게 이동
- 라우팅: 홈, 지역 커뮤니티, 소개 페이지 제공

## 주요 기능

- 전국 지도에서 지역을 선택해 날씨 상세 정보 확인
- 최근 본 지역과 즐겨찾기 목록 관리
- 지역별 커뮤니티 댓글 목록과 작성/수정/삭제
- 기온 단위 전환(섭씨/화씨)
- Vite 기반 개발·빌드 환경

## 기술 스택

- Vue 3 + Vite
- Vue Router
- Pinia
- Axios
- Supabase client
- OpenWeather API + 기상청 초단기예보 API

## 요구 사항

- Node.js 22.18 이상 또는 24.12 이상
- npm
- OpenWeather API 키
- 기상청 API 서비스 키
- Supabase 프로젝트 정보(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)

## 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 설정합니다.

```env
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
VITE_KMA_SERVICE_KEY=your_data_go_kr_service_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_supabase_service_role_key
```

기본 예시는 [.env.example](.env.example) 파일을 참고하세요.

## 실행 방법

### 1) 의존성 설치

```sh
npm install
```

### 2) 개발 서버 실행

```sh
npm run dev
```

개발 서버는 기본적으로 Vite 프론트엔드가 실행되며, 커뮤니티 기능은 `/api/comments` 경로를 통해 서버 API와 연결됩니다.

### 3) 프로덕션 빌드

```sh
npm run build
```

### 4) 정적 결과 미리보기

```sh
npm run preview
```

### 5) 린트 실행

```sh
npm run lint
```

## 라우팅 구성

- `/` : 메인 날씨 지도 화면
- `/community/:cityId` 또는 `/weather/:cityId` : 지역별 커뮤니티 페이지
- `/about` : 소개 페이지
- 그 외 경로는 `NotFoundView`로 이동

## 배포 참고

- Vercel 배포를 기준으로 구성되어 있으며, `vercel.json`에서 SPA 라우팅을 위한 rewrite 설정을 사용합니다.
- 프론트엔드 배포와 함께 서버 API 환경 변수가 올바르게 주입되어야 커뮤니티 기능이 정상 동작합니다.

## 개발 팁

- IDE는 [VS Code](https://code.visualstudio.com/)와 [Vue Official 확장](https://marketplace.visualstudio.com/items?itemName=Vue.volar)을 권장합니다.
- 브라우저 개발 도구로 Vue DevTools를 활용하면 컴포넌트 상태를 쉽게 확인할 수 있습니다.
