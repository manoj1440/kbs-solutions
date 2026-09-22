# F-202 Training content administration (modules, videos, MCQs, thresholds)

- Group: Training · Status: **PLANNED** · Depends on: F-104, F-108
- PRD refs: REQ-05 §5.2 (Admin alone uploads/maintains three modules with video + MCQ-only assessment), §5.3 (Admin-configured threshold; retry/attempt/shuffle/video-required configurable), REQ-16 §16.1, REQ-25 §25.4

## Detailed requirements
1. Exactly three `TrainingModule` rows (sequence 1..3) — created by seed as drafts; Admin edits title, uploads video (`StoredFile purpose=TRAINING_VIDEO`, mp4/webm ≤ `files.maxUploadMb`), optional material text (markdown), pass threshold % (defaults from config), and MCQ list (question text, 2–6 options, exactly one correct key).
2. Publishing creates a new `version`; in-progress attempts keep the version they started with; results reference module version.
3. Question shuffling and option shuffling controlled by `training.shuffleQuestions`; correct keys never sent to the client before submission.
4. Web screens: Training → Modules list (status/version), Module editor (video upload with progress, material, questions editor with validation), Publish confirmation, Config panel showing `training.*` keys with links to F-104.

## Acceptance criteria
- [ ] Cannot publish a module with 0 questions or a question without a correct option.
- [ ] Version increments on publish; older version remains readable for historic attempts.
- [ ] Client payload for an assessment contains no `correctKey`.
