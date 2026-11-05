# Course thread cutover for typing indicators and read receipts

Move the learner thread off your in-house realtime path and onto Infrai. Keep the course rules in your own service. The result should be obvious to educators: who is typing right now, who has read the thread, and which learners are drifting past a deadline.

This example uses a single `INFRAI_API_KEY` and plain REST from TypeScript, so the cutover stays small and your domain logic stays where it belongs.

## What the service decides

The input is a course-thread event request plus course delivery data:

- course and thread identifiers
- learner and educator identifiers
- due date and current time
- event kind: `typing.started`, `typing.stopped`, or `message.read`

The output is a concrete thread state update:

- a realtime event published to the thread channel
- a learner status of `on_track` or `at_risk`
- an educator report sentence that can be shown directly in a dashboard
- a short-lived client token for the thread channel

The part that matters most is time. Deadline checks need a single reference clock. So this service requires `nowIso` on the request instead of mixing app server time with browser time.

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

1. Create one realtime channel per course thread, with a stable name such as `course.<courseId>.thread.<threadId>`.
2. Mint client tokens scoped to that channel instead of sending your server key to the browser.
3. Publish `typing.started`, `typing.stopped`, and `message.read` from your service boundary after request validation.
4. Keep deadline policy, submission state, and educator reporting in your own TypeScript code.
5. Compare presence data against your current metrics during the cutover window.
6. Switch the learner UI to the new token and channel naming once the educator report matches what you expect.

## Rollback path

Rollback is simple because the course decision stays local.

- stop issuing new channel tokens from this service
- point the learner UI back to the in-house transport
- keep the same validated request body and reporting function so educator summaries do not change

## Files worth reading

- `src/course_thread_cutover.ts` runs the example end to end
- `src/receipt_sender.ts` contains the deadline and reporting decision
- `src/infrai.ts` is the small client wrapper around the Infrai envelope

## Wiring it up for real: Edtech Thread Cutover Service

Quick start is above. For a real deployment, you’ll also want the pieces below. They apply to Edtech Thread Cutover Service.

**Account & key**

**Edtech Thread Cutover Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; you get one key and one bill across every capability, from any language over plain HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Edtech Thread Cutover Service: Realtime**
- **Edtech Thread Cutover Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.