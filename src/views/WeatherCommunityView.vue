<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useTemperature } from '../composables/useTemperature'
import { findProvinceById } from '../data/regions'
import {
  createCommunityComment,
  deleteCommunityComment,
  getCommunityComments,
  updateCommunityComment,
} from '../services/community'
import { getWeatherForRegion } from '../services/openWeather'

const NICKNAME_KEY = 'oneul-weather-community-nickname'
const COMMUNITY_PREVIEW_SYNC_KEY = 'onul-weather-community-sync'
const quickMessages = ['생각보다 더워요', '바람이 세요', '우산이 필요해요', '산책하기 좋아요']

const route = useRoute()
const { displayTemperature, unitSymbol } = useTemperature()
const province = ref(null)
const district = ref('')
const weather = ref(null)
const isLoading = ref(true)
const weatherError = ref('')
const comments = ref([])
const isCommentsLoading = ref(false)
const commentsError = ref('')
const nickname = ref(localStorage.getItem(NICKNAME_KEY) || '')
const commentText = ref('')
const commentPassword = ref('')
const isSubmitting = ref(false)
const submitError = ref('')
const activeCommentId = ref('')
const commentActionMode = ref('')
const actionPassword = ref('')
const editContent = ref('')
const isManagingComment = ref(false)
const manageError = ref('')

const regionId = computed(() => String(route.params.cityId || ''))
const commentCountLabel = computed(() =>
  comments.value.length
    ? `${comments.value.length}개의 이야기`
    : '아직 첫 이야기를 기다리고 있어요',
)

const parseRegion = (cityId) => {
  // 라우트에는 provinceId--district 형식을 사용해 이름이 같은 구역을 구분한다.
  const separatorIndex = cityId.indexOf('--')
  const provinceId = separatorIndex > 0 ? cityId.slice(0, separatorIndex) : ''
  const districtName = separatorIndex > 0 ? cityId.slice(separatorIndex + 2) : ''
  return { province: findProvinceById(provinceId), district: districtName }
}

const loadComments = async () => {
  if (!regionId.value.includes('--')) return
  isCommentsLoading.value = true
  commentsError.value = ''
  try {
    comments.value = await getCommunityComments(regionId.value)
  } catch (error) {
    comments.value = []
    commentsError.value =
      error.response?.data?.message ||
      '지역 이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isCommentsLoading.value = false
  }
}

const loadCommunity = async (cityId) => {
  const parsed = parseRegion(cityId)
  province.value = parsed.province ?? null
  district.value = parsed.district
  weather.value = null
  weatherError.value = ''

  if (!parsed.province || !parsed.district) {
    isLoading.value = false
    weatherError.value = '요청한 지역 정보를 찾을 수 없어요.'
    return
  }

  isLoading.value = true
  // 날씨와 댓글은 서로 독립적이므로 동시에 요청해 초기 표시 시간을 줄인다.
  const commentsPromise = loadComments()
  try {
    weather.value = await getWeatherForRegion(parsed.district, parsed.province)
  } catch (error) {
    weatherError.value = error.message
  } finally {
    isLoading.value = false
  }
  await commentsPromise
}

const useQuickMessage = (message) => {
  commentText.value = commentText.value ? `${commentText.value} ${message}` : message
  submitError.value = ''
}

const submitComment = async () => {
  const cleanNickname = nickname.value.trim()
  const cleanContent = commentText.value.trim()
  if (!cleanNickname || !cleanContent || !weather.value || commentPassword.value.length < 4) {
    submitError.value = '닉네임, 날씨 이야기, 4자 이상의 비밀번호를 입력해 주세요.'
    return
  }

  isSubmitting.value = true
  submitError.value = ''
  try {
    const created = await createCommunityComment({
      regionId: regionId.value,
      provinceName: province.value.name,
      districtName: district.value,
      nickname: cleanNickname,
      content: cleanContent,
      password: commentPassword.value,
      temperatureC: weather.value.temp,
      weatherDescription: weather.value.description,
      weatherObservedAt: weather.value.observedAt.toISOString(),
    })
    localStorage.setItem(NICKNAME_KEY, cleanNickname)
    localStorage.setItem(
      COMMUNITY_PREVIEW_SYNC_KEY,
      JSON.stringify({ cityId: regionId.value, createdAt: Date.now() }),
    )
    comments.value = [created, ...comments.value]
    commentText.value = ''
    commentPassword.value = ''
    commentsError.value = ''
  } catch (error) {
    submitError.value = error.response?.data?.message || '이야기를 등록하지 못했어요.'
  } finally {
    isSubmitting.value = false
  }
}

const startCommentAction = (comment, mode) => {
  activeCommentId.value = comment.id
  commentActionMode.value = mode
  actionPassword.value = ''
  editContent.value = comment.content
  manageError.value = ''
}

const cancelCommentAction = () => {
  activeCommentId.value = ''
  commentActionMode.value = ''
  actionPassword.value = ''
  editContent.value = ''
  manageError.value = ''
}

const saveEditedComment = async (comment) => {
  const content = editContent.value.trim()
  if (!content || actionPassword.value.length < 4) {
    manageError.value = '수정할 내용과 4자 이상의 비밀번호를 입력해 주세요.'
    return
  }

  isManagingComment.value = true
  manageError.value = ''
  try {
    const updated = await updateCommunityComment({
      id: comment.id,
      regionId: regionId.value,
      content,
      password: actionPassword.value,
    })
    comments.value = comments.value.map((item) => (item.id === updated.id ? updated : item))
    cancelCommentAction()
  } catch (error) {
    manageError.value = error.response?.data?.message || '이야기를 수정하지 못했어요.'
  } finally {
    isManagingComment.value = false
  }
}

const removeComment = async (comment) => {
  if (actionPassword.value.length < 4) {
    manageError.value = '작성할 때 사용한 비밀번호를 입력해 주세요.'
    return
  }

  isManagingComment.value = true
  manageError.value = ''
  try {
    await deleteCommunityComment({
      id: comment.id,
      regionId: regionId.value,
      password: actionPassword.value,
    })
    comments.value = comments.value.filter((item) => item.id !== comment.id)
    cancelCommentAction()
  } catch (error) {
    manageError.value = error.response?.data?.message || '이야기를 삭제하지 못했어요.'
  } finally {
    isManagingComment.value = false
  }
}

const formatRelativeTime = (value) => {
  // 서버 시각을 기준으로 목록을 다시 가져오지 않아도 화면에서 상대 시간을 계산한다.
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 1) return '방금 전'
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}시간 전`
  return `${Math.floor(elapsedHours / 24)}일 전`
}

watch(
  () => regionId.value,
  (cityId) => loadCommunity(cityId),
  { immediate: true },
)
</script>

<template>
  <main class="subpage-shell community-page">
    <RouterLink class="back-link" to="/">← 날씨 지도로 돌아가기</RouterLink>

    <section v-if="isLoading" class="subpage-state" aria-live="polite">
      <span class="loader" aria-hidden="true"></span>
      <h1>{{ district }} 커뮤니티를 준비하고 있어요</h1>
    </section>

    <section v-else-if="weatherError" class="subpage-state" role="alert">
      <p class="subpage-kicker">WEATHER COMMUNITY</p>
      <h1>지역 커뮤니티를 열지 못했어요</h1>
      <p>{{ weatherError }}</p>
      <RouterLink class="primary-link" to="/">지역 다시 선택하기</RouterLink>
    </section>

    <template v-else>
      <section class="community-dashboard">
        <div class="community-weather-summary">
          <div>
            <span>{{ province.name }}</span>
            <strong>{{ district }}</strong>
            <p>{{ weather.description }}</p>
          </div>
          <p class="community-temperature">
            {{ displayTemperature(weather.temp) }}<sup>{{ unitSymbol }}</sup>
          </p>
          <dl>
            <div>
              <dt>체감</dt>
              <dd>{{ displayTemperature(weather.feelsLike) }}{{ unitSymbol }}</dd>
            </div>
            <div>
              <dt>습도</dt>
              <dd>{{ weather.humidity }}%</dd>
            </div>
            <div>
              <dt>바람</dt>
              <dd>{{ weather.windSpeed }}m/s</dd>
            </div>
          </dl>
        </div>

        <aside class="community-composer" aria-labelledby="composer-title">
          <div class="community-section-heading">
            <span>지금 현장은 어떤가요?</span>
            <h2 id="composer-title">날씨 한마디 남기기</h2>
          </div>

          <label class="community-nickname">
            <span>닉네임</span>
            <input v-model="nickname" maxlength="20" placeholder="예: 산책하는 사람" />
          </label>

          <div class="community-quick-messages" aria-label="빠른 문구">
            <button
              v-for="message in quickMessages"
              :key="message"
              type="button"
              @click="useQuickMessage(message)"
            >
              {{ message }}
            </button>
          </div>

          <label class="community-textarea">
            <span class="sr-only">커뮤니티 글</span>
            <textarea
              v-model="commentText"
              maxlength="300"
              rows="2"
              :placeholder="`지금 ${district}의 날씨를 느낀 그대로 알려주세요.`"
              @input="submitError = ''"
            />
            <small>{{ commentText.length }}/300</small>
          </label>

          <label class="community-password">
            <span>수정·삭제 비밀번호</span>
            <input
              v-model="commentPassword"
              type="password"
              minlength="4"
              maxlength="40"
              autocomplete="new-password"
              placeholder="4자 이상 입력해 주세요"
              @input="submitError = ''"
            />
            <small>비밀번호는 암호화되어 저장되며, 수정·삭제할 때 필요해요.</small>
          </label>

          <p v-if="submitError" class="community-form-error" role="alert">{{ submitError }}</p>
          <button
            class="community-submit"
            type="button"
            :disabled="
              isSubmitting || !commentText.trim() || !nickname.trim() || commentPassword.length < 4
            "
            @click="submitComment"
          >
            {{ isSubmitting ? '등록하고 있어요…' : '현재 날씨와 함께 등록하기' }}
          </button>
        </aside>

        <section class="community-feed" aria-labelledby="feed-title">
          <header class="community-feed-header">
            <div>
              <span>최근 7일</span>
              <h2 id="feed-title">{{ district }} 실시간 커뮤니티</h2>
            </div>
            <p>{{ commentCountLabel }}</p>
          </header>

          <div v-if="isCommentsLoading" class="community-feed-state" aria-live="polite">
            <span class="loader" aria-hidden="true"></span>
            <p>이웃들의 이야기를 불러오고 있어요.</p>
          </div>

          <div v-else-if="commentsError" class="community-feed-state is-error" role="alert">
            <strong>커뮤니티 연결이 필요해요</strong>
            <p>{{ commentsError }}</p>
            <button type="button" @click="loadComments">다시 불러오기</button>
          </div>

          <div v-else-if="!comments.length" class="community-feed-state is-empty">
            <strong>아직 등록된 이야기가 없어요</strong>
            <p>지금 날씨를 가장 먼저 알려주세요.</p>
          </div>

          <ol v-else class="community-comment-list">
            <li v-for="comment in comments" :key="comment.id" class="community-comment">
              <div class="community-avatar" aria-hidden="true">
                {{ comment.nickname.slice(0, 1) }}
              </div>
              <article>
                <header>
                  <div>
                    <strong>{{ comment.nickname }}</strong>
                    <span>{{ formatRelativeTime(comment.createdAt) }}</span>
                  </div>
                  <div class="community-comment-actions">
                    <button type="button" @click="startCommentAction(comment, 'edit')">수정</button>
                    <button type="button" @click="startCommentAction(comment, 'delete')">
                      삭제
                    </button>
                  </div>
                </header>
                <p>{{ comment.content }}</p>
                <div class="community-weather-stamp">
                  <strong>{{ displayTemperature(comment.temperatureC) }}{{ unitSymbol }}</strong>
                  <span>{{ comment.weatherDescription }}</span>
                  <small>작성 당시 날씨</small>
                </div>

                <div
                  v-if="activeCommentId === comment.id"
                  class="community-manage-panel"
                  :class="{ 'is-delete': commentActionMode === 'delete' }"
                >
                  <template v-if="commentActionMode === 'edit'">
                    <label>
                      <span class="sr-only">수정할 내용</span>
                      <textarea
                        v-model="editContent"
                        maxlength="300"
                        rows="3"
                        @input="manageError = ''"
                      />
                    </label>
                  </template>
                  <p v-else>이 이야기를 삭제할까요? 삭제 후에는 복구할 수 없어요.</p>

                  <label class="community-action-password">
                    <span class="sr-only">작성 비밀번호</span>
                    <input
                      v-model="actionPassword"
                      type="password"
                      minlength="4"
                      maxlength="40"
                      autocomplete="current-password"
                      placeholder="작성할 때 사용한 비밀번호"
                      @input="manageError = ''"
                    />
                  </label>
                  <p v-if="manageError" class="community-form-error" role="alert">
                    {{ manageError }}
                  </p>
                  <div class="community-manage-buttons">
                    <button
                      type="button"
                      :disabled="isManagingComment"
                      @click="cancelCommentAction"
                    >
                      취소
                    </button>
                    <button
                      v-if="commentActionMode === 'edit'"
                      class="is-primary"
                      type="button"
                      :disabled="isManagingComment"
                      @click="saveEditedComment(comment)"
                    >
                      {{ isManagingComment ? '수정 중…' : '수정 완료' }}
                    </button>
                    <button
                      v-else
                      class="is-danger"
                      type="button"
                      :disabled="isManagingComment"
                      @click="removeComment(comment)"
                    >
                      {{ isManagingComment ? '삭제 중…' : '삭제하기' }}
                    </button>
                  </div>
                </div>
              </article>
            </li>
          </ol>
        </section>
      </section>
    </template>
  </main>
</template>
