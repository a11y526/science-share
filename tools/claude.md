# 과학 1 자료실 → 내 포털로 가져오기 (Claude Code가 따르는 순서)

선생님이 "공유 자료실의 ○○ 차시를 내 포털에 넣어 줘"라고 하면 Claude는 아래대로 한다.
선생님은 개발자가 아니다. 할 일은 번호를 매긴 쉬운 한국어로 알린다.

1. 지금 폴더가 선생님 포털 저장소인지 본다: `lessons/`·`sims/`·`assets/js/site.js`가 있어야 한다. 없으면 멈추고 포털 폴더를 열어 달라고 한다.
2. `https://a11y526.github.io/science-share/catalog.json`을 받는다. `units[].lessons[]`에서 `code`가 고른 차시인 것을 찾는다.
3. 그 차시 `files[]` 중 `portal` 값이 있는 것만 가져온다. 주소는 `https://a11y526.github.io/science-share/` + `path`(한글은 URL 인코딩), 저장 자리는 저장소 안 `portal` 경로(`lessons/721.html`, `sims/721_earth_spin.html` …).
   - `portal`이 `lessons/` 또는 `sims/`로 시작하지 않으면 건너뛴다.
   - 같은 자리에 파일이 있고 내용이 다르면, 선생님이 고친 파일일 수 있으니 **덮어쓰기 전에 묻는다**.
4. 받은 파일만 `git add` → `git commit -m "공유 자료 가져오기: 721"` → `git push`(거절되면 `git pull --no-rebase` 뒤 다시). `site.js`·다른 파일은 건드리지 않는다.
5. 끝나면 선생님께:
   1. 2~5분 뒤 `https://(계정).github.io/(저장소)/lessons/721.html`이 열리는지 확인
   2. 관리 화면 → 차시 → 수업자료 주소에 위 주소를 넣고 저장
   3. 학습지 PDF·PPT는 자료실에서 [내려받기]로 받아 쓰기(웹 학습지는 정답이 들어 있어 자료실에 없음)
