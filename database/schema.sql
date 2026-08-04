CREATE TABLE IF NOT EXISTS weather_comments (
  id BIGSERIAL PRIMARY KEY,
  region_id VARCHAR(140) NOT NULL,
  province_name VARCHAR(60) NOT NULL,
  district_name VARCHAR(60) NOT NULL,
  nickname VARCHAR(20) NOT NULL,
  content VARCHAR(300) NOT NULL,
  temperature_c SMALLINT NOT NULL,
  weather_description VARCHAR(80) NOT NULL,
  weather_observed_at TIMESTAMPTZ NOT NULL,
  author_token_hash CHAR(64) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블을 사용하는 환경의 비밀번호 권한 컬럼 마이그레이션
ALTER TABLE weather_comments
  ADD COLUMN IF NOT EXISTS password_hash CHAR(64);

ALTER TABLE weather_comments
  ADD COLUMN IF NOT EXISTS password_salt CHAR(32);

CREATE INDEX IF NOT EXISTS weather_comments_region_created_idx
  ON weather_comments (region_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS weather_comments_author_created_idx
  ON weather_comments (author_token_hash, created_at DESC);
