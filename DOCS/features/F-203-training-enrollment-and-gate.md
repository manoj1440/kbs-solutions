# F-203 Training enrollment, 72-hour window, sequential modules, assessment

- Group: Training · Status: **DONE** · Depends on: F-111, F-201, F-202
- PRD refs: REQ-05 §5.1 (72 h elapsed from first successful OTP login; subsequent logins do not reset), §5.2 (index, current module, video, questions, results, score, deadline; block M2 until M1 passes …), §5.3 (marks from correct MCQ answers vs configured threshold; passed stays passed; failed/unfinished stays current), §5.5, REQ-23 §23.2, REQ-25 §25.2 (Training landing, Module learning, MCQ result)
- QA ids: TRAIN-02, TRAIN-03

## Detailed requirements
1. On the Telecaller's **first successful OTP verify**, set `TrainingEnrollment.firstLoginAt=now`, `deadlineAt = firstLoginAt + training.windowHours`, `status=IN_PROGRESS`, `currentModuleSequence=1`, module results `M1=IN_PROGRESS, M2=LOCKED, M3=LOCKED`. Idempotent: later logins never touch these.
2. `GET /training/me` → index with deadline, per-module status, best score, attempts used/limit, video completion, whether assessment is available (video completed if `training.videoCompletionRequired`).
3. `POST /training/modules/:seq/video-progress {positionSec, completed}` (server marks `videoCompletedAt` only when `completed` and position ≥ 95% of known duration).
4. `POST /training/modules/:seq/attempts` → returns shuffled questions (ids + options, no answers) and `attemptId`; refused if module `LOCKED`, if attempt limit reached, if deadline passed (`GATE_TRAINING_BLOCKED` with reason `DEADLINE_PASSED`), or if a prior module is not `PASSED`.
5. `POST /training/attempts/:id/submit {answers}` → score % = correct/total×100 (no partial credit); `passed = score ≥ module.passThresholdPct` under `PER_MODULE_THRESHOLD`; under `AVERAGE_ACROSS_MODULES` a module is provisionally passed at ≥ its own threshold and the enrollment is `PASSED` only when the average of best scores ≥ `training.defaultPassThresholdPct` — the rule is read from config, never hard-coded. Passed → module `PASSED`, next module `IN_PROGRESS`, `currentModuleSequence++`. Failed → stays `IN_PROGRESS`, attempt recorded. If the deadline passes mid-assessment the submission is still scored and stored, but the gate remains closed afterwards (REQ-23 §23.2).
6. All three passed → `status=PASSED`, notification to Telecaller and Manager; calling queue gate opens (F-111).
7. Mobile screens: Training landing (three module cards with lock/pass icons, deadline countdown, deactivation explanation if applicable), Module learning (video player with progress reporting, material), Assessment (one question per screen or list, submit with confirmation), Result (score, threshold, retry availability, next module CTA).

## Acceptance criteria
- [x] TRAIN-02: two logins produce one `firstLoginAt`/`deadlineAt`.
- [x] TRAIN-03: M2 attempt before M1 pass → refused; queue blocked until M3 passes.
- [x] Pass at exactly threshold passes; below fails; passed module cannot regress after a later worse attempt.
- [x] Attempt limit honoured when set; unlimited when null.

## Progress notes
- 2026-09-22 (session 2): `GET /training/me`, video-progress, start attempt (shuffled, no answers, resumes an open attempt), submit (score, per-module or averaged rule from config, no regression, next module unlock, PASSED enrollment + notifications). Minimal notifications module added (`GET /notifications`, mark read) — F-701 extends it. Mobile: training landing, module (expo-video with completion reporting), assessment + result screens; Expo bundle verified. e2e: `training-learner.e2e-spec.ts` (TRAIN-03, exact-threshold pass, no regression, attempt limit, deadline block).
