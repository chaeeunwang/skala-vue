# ONEUL WEATHER

지도로 지역 날씨를 확인하고, 현재 기온과 함께 현장의 정보를 나누는 날씨 커뮤니티 Vue 앱입니다.

## PostgreSQL 커뮤니티 설정

1. `.env.example`을 참고해 `.env.local`에 `DATABASE_URL`을 설정합니다.
2. DB 사용자에게 테이블 생성 권한이 있다면 개발 서버가 최초 요청 시 스키마를 자동 생성합니다.
3. 직접 마이그레이션하려면 PostgreSQL에서 `database/schema.sql`을 실행합니다.

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/oneul_weather
DATABASE_SSL=disable
```

클라우드 PostgreSQL처럼 SSL 연결이 필요한 환경에서는 `DATABASE_SSL=require`를 사용합니다.

커뮤니티 글 작성 시 4~40자의 수정·삭제 비밀번호가 필요합니다. 서버는 비밀번호 원문 대신
댓글별 무작위 솔트와 `scrypt` 해시만 저장하며, 동일한 비밀번호가 확인된 경우에만 수정과
삭제를 허용합니다.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

개발 서버에는 `/api/comments` API가 함께 연결됩니다. 배포 환경에서는 `api/comments.js`가 동일한 PostgreSQL API를 제공합니다.

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
