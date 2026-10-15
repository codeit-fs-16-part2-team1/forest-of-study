# React·Vite 적용 규칙

## 컴포넌트와 상태

- 입력·서버 데이터와 그 값으로 계산할 수 있는 표시값을 구분한다. 간단한 표시값을 별도 state와 Effect로 동기화하지 않는다.
- 사용자 클릭으로만 발생하는 변경 요청은 이벤트 처리 흐름에서 호출한다. Effect가 실행된다는 이유로 생성·체크·완료 요청을 자동 반복하지 않는다.
- Effect의 의존성을 숨겨 실행 횟수를 맞추지 않는다. 타이머·이벤트 구독은 정리 함수를 두고, 조회 응답이 늦게 도착해 다른 스터디 화면을 덮어쓰지 않도록 현재 요청과 화면의 관계를 확인한다.
- 단순 문자열·불리언 계산에 useMemo를 기본 적용하지 않는다. 무거운 계산이나 실제 렌더링 문제에 근거해 최적화한다.
- 공통 상태는 필요한 컴포넌트들의 가장 가까운 공통 위치에 둔다. 작은 화면에 Context·복합 컴포넌트 패턴을 일괄 도입하지 않는다. boolean prop 조합이 복잡해질 때 구성 분리를 검토한다.

```jsx
const StudyHeading = ({ nickname, name }) => {
  const title = `${nickname}의 ${name}`;
  return <h1>{title}</h1>;
};
```

이 예시는 파생 문자열을 state로 복제하지 않는 방식만 보여준다. 실제 화면 문구는 README와 시안을 따른다.

## React Router·axios

- 페이지 이동은 React Router의 Link·라우팅 기능을 사용하고 조작은 button으로 표현한다. 화면 주소를 API 리소스 경로로 바꾸지 않는다.
- 통신은 프로젝트의 axios 구성과 API 모듈을 먼저 확인해 재사용한다. 비밀번호는 필요한 보호 요청에만 전달하고 공개 API까지 전역 기본 헤더로 전파하지 않는다.
- 독립적인 조회는 병렬화를 검토한다. 스터디 생성 후 받은 ID로 다음 요청을 보내는 등 데이터 의존성이 있는 작업은 순서를 유지한다. 의존성이 부분적으로 겹친다는 이유로 새 병렬화 라이브러리를 추가하지 않는다.
- 204 응답에서 JSON 데이터가 있다고 가정하지 않는다. 목록 pagination과 실패 error 구조는 [API.md](../../../../docs/API.md)를 따른다.
- 요청 실패 시 현재 페이지를 유지하고 재시도 가능한 상태를 보존한다. 모달 닫기는 이미 전송된 서버 변경의 취소를 뜻하지 않는다. 요청 중간 취소 기능은 명세에 없는 기능으로 추가하지 않는다.

## 인증과 집중 화면

- 비밀번호는 보호 페이지 진입마다 확인하고 해당 페이지 메모리에만 둔다. 앱 전체에서 인증이 유지되는 전역 상태·토큰·쿠키·LocalStorage·URL·로그를 만들지 않는다.
- 페이지 이탈·새로고침 후에는 다시 입력한다. 진입 확인 응답을 저장해 다음 보호 요청의 비밀번호 검증을 생략하지 않는다.
- 입력 정리는 API.md의 공통 비밀번호 기준을 확인한다. ADR-062는 프론트·서버의 모든 공백 제거 후 검사를 정하며, 일반 문자열 trim 규칙과 다르다. 이전 ADR-057의 원문 공백 거절을 현재 규칙으로 적용하지 않는다.
- 서버의 집중 상태와 시간 파생값을 기준으로 표시한다. 브라우저 interval 횟수를 완료 판정·포인트 지급의 근거로 사용하지 않는다.
- RUNNING은 이탈 중에도 진행하고 PAUSED는 유지한다. 페이지 종료·탭 전환 이벤트에서 자동 pause·Heartbeat를 보내지 않는다.
- 남은 시간 0은 서버의 완료·지급 처리와 구분한다. 완료 요청 후 받은 challenge·points·settlement로 표시하고 재렌더링에 따른 중복 호출을 피한다.
- 주간 기록 응답은 ADR-060의 축소 구조를 따른다. completed의 null은 사용 기간 밖, false는 유효한 날짜의 미체크다. 미래 날짜라는 이유만으로 null을 만들지 않는다.

## 스타일과 접근성

- 기존 Sass 구조와 reset 스타일을 확인하고 재사용한다. 새로운 스타일 라이브러리나 CSS 프레임워크를 추가하지 않는다.
- 링크·버튼·폼 필드의 의미를 지키고 아이콘만 있는 버튼에는 접근 가능한 이름을 둔다. 키보드 포커스를 제거해 상태를 숨기지 않는다.
- 모달·반응형 breakpoint·오류/완료 화면의 미정 시안은 확정된 것처럼 만들지 않는다. 구체 구현은 사용자 요청과 디자인 범위를 확인한다.

## 참고한 외부 규칙

Vercel 규칙에서 프로젝트에 맞는 주제를 선별해 한국어로 정리했다. 외부 예시의 TypeScript·Next.js 전용 코드와 추가 라이브러리는 적용하지 않는다. 후속 개정 시 출처를 확인하되 변경된 외부 권고를 팀 계약으로 자동 승격하지 않는다.

- [React Best Practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)
- [독립 작업의 병렬 처리](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-parallel.md)
- [Effect 없이 파생값 계산](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rerender-derived-state-no-effect.md)
- [단순 계산의 불필요한 메모화 방지](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rerender-simple-expression-in-memo.md)
- [컴포넌트 구성 패턴](https://github.com/vercel-labs/agent-skills/blob/main/skills/composition-patterns/SKILL.md)
