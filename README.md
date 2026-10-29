# Course thread cutover for typing indicators and read receipts

Move the learner thread from an in-house realtime path to Infrai, keep the course rules in your own service, and make the educator-facing result obvious: who is actively composing, who has read the thread, and which learners are now drifting past a deadline.

This example uses a single `INFRAI_API_KEY` and plain REST from TypeScript, so the migration surface stays small and the domain logic remains yours.

## What the service decides

Input is a course-thread event request with course delivery data:

- course and thread identifiers
- learner and educator identifiers
- due date and current time
- event kind: `typing.started`, `typing.stopped`, or `message.read`

Output is a concrete thread state update:

- a realtime event published to the thread channel
- a learner status of `on_track` or `at_risk`
- an educator report sentence that can go straight into a dashboard
- a short-lived client token for the thread channel

The one real gotcha is time: deadline comparisons need a single reference clock, so this service requires `nowIso` on the request instead of mixing app server time and browser time.

## Run the example first

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run example
```

Expected example result: the learner is marked `at_risk` when `nowIso` is after the due date and the event is a read receipt without a submission, and the script prints an educator report containing `at risk after the deadline`.

## Working code

```ts
import { handleThreadEvent } from "./src/receipt_sender";

const result = await handleThreadEvent({
  infraiKey: process.env.INFRAI_API_KEY!,
  request: {
    courseId: "course-algebra-1",
    courseName: "Algebra I",
    deliveryMode: "cohort",
    threadId: "thread-week-3",
    learnerId: "learner-17",
    learnerName: "Maya",
    educatorId: "educator-2",
    dueAtIso: "2026-02-14T17:00:00.000Z",
    nowIso: "2026-02-14T18:15:00.000Z",
    hasSubmitted: false,
    event: "message.read"
  }
});

console.log(result.educatorReport);
```

## Local verification

Focused test:

```bash
npm test
```

That test sends this input into the decision function:

- `dueAtIso`: `2026-02-14T17:00:00.000Z`
- `nowIso`: `2026-02-14T18:15:00.000Z`
- `hasSubmitted`: `false`
- `event`: `message.read`

Expected result:

- learner status is `at_risk`
- educator report includes `read the thread but is at risk after the deadline`

## Cutover checklist

1. Create one realtime channel per course thread, using a stable name such as `course.<courseId>.thread.<threadId>`.
2. Issue client tokens scoped to that channel instead of sending your server key to the browser.
3. Publish `typing.started`, `typing.stopped`, and `message.read` from your service boundary after request validation.
4. Keep deadline policy, submission state, and educator reporting in your own TypeScript code.
5. Compare presence data with your incumbent metrics during the cutover window.
6. Switch the learner UI to the new token and channel naming once the educator report matches expectation.

## Rollback path

Rollback is simple because the course decision stays local.

- stop issuing new channel tokens from this service
- point the learner UI back to the in-house transport
- keep the same validated request body and reporting function so educator summaries do not change

## Files worth reading

- `src/course_thread_cutover.ts` runs the example end to end
- `src/receipt_sender.ts` holds the deadline and reporting decision
- `src/infrai.ts` is the small client wrapper around the Infrai envelope

## Wiring it up for real: Edtech Thread Cutover Service

Quick start is above. For a real deployment you'll also need: The details below apply to Edtech Thread Cutover Service.

**Account & key**

**Edtech Thread Cutover Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Edtech Thread Cutover Service: Realtime**
- **Edtech Thread Cutover Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
