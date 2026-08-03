<script setup>
import { ref } from 'vue'
const rawHtmlData = '이 글자는 <span style="color: red; font-weight: bold;">빨간색 굵은 글자</span>이다.'

const inputValue = ref('')
const message = ref('')

function showMessage() {
  message.value = inputValue.value
}

const content = '안녕하세요! <strong< Skala-Vue</strong> 강의입니다.'

const dynamicUrl = 'https://www.naver.com'
const logoImgSrc = 'https://vuejs.org/images/logo.png'
const isButtonDisabled = ref(false)

const isWarning = ref(false) // 객체 바인딩용 스위치
const themeClass = ref('bg-dark') // 배열 바인딩용 고정 클래스

</script>

<template>
  <div class="practice-section">
    <h2>v-html 디렉티브 학습</h2>
    <h3>일반 보간법 {{}} 사용 결과:</h3>
    <p>{{ rawHtmlData }}</p>
    <br />
    <h3>v-html 디렉티브 사용 결과:</h3>
    <p v-html="rawHtmlData"></p>

    <h2>v-html XSS 학습</h2>
    <input v-model="inputValue" placeholder="내용을 입력하세요" />
    <button @click="showMessage">확인</button>
    <div v-html="message"></div>

    <h2>v-text 디렉티브 학습</h2>
    <h3>1) 일반 보간법 {{}} 결과:</h3>
    <p>출력: {{ content }}</p>
    <br />
    <h3>2) v-text 디렉티브 결과:</h3>
    <p v-text="'출력: ' + content"></p>
    <br />
    <h3>3) v-html 결과 비교:</h3>
    <p v-html="content"></p>

    <h2>v-bind 디렉티브 기본 (축약형: 콜론)</h2>
    <h3>1) 동적 링크 연결</h3>
    <a :href="dynamicUrl">여기를 클릭하면 네이버로 이동합니다</a>
    <br />
    <h3>2) 동적 이미지 연결</h3>
    <img :src="logoImgSrc" alt="Vue 로고" style="width: 100px" />
    <br />
    <h3>3) 버튼 비활성화 제어</h3>
    <p>현재 버튼 사용 불가능 상태: {{ isButtonDisabled }}</p>
    <button :disabled="isButtonDisabled">동의해야 클릭할 수 있는 버튼</button>&nbsp;
    <button @click="isButtonDisabled = !isButtonDisabled">위 버튼 잠금 해제/토글하기</button>

    <h2>v-bind 디렉티브 고급 (클래스 바인딩)</h2>
    <h3>클래스 바인딩 (객체 형식)</h3>
    <p :class="{ 'text-danger': isWarning }">현재 경고 상태: {{ isWarning }}</p>
    <button @click="isWarning = !isWarning">경고 상태 토글</button>
    <br />
    <h3>클래스 바인딩 (배열 형식)</h3>
    <div :class="[themeClass, isWarning ? 'border-red' : 'border-gray']">다중 클래스가 조립된 박스 구역입니다.</div>

  </div>
</template>

<style scoped>
.text-danger {color: red; font-weight: bold;}
.bg-dark {background-color: #333; color: white; padding: 15px;}
.border-red {border: 3px solid red;}
.border-gray {border: 3px solid #ccc;}
</style>
