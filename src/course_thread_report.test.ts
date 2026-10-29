import test from "node:test";
import assert from "node:assert/strict";
import { buildThreadDecision } from "./receipt_sender";

test("marks a learner at risk after reading a thread past the deadline without submission", () => {
  const decision = buildThreadDecision({
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
  });

  assert.equal(decision.learnerStatus, "at_risk");
  assert.match(decision.educatorReport, /read the thread but is at risk after the deadline/);
  assert.equal(decision.channel, "course.course-algebra-1.thread.thread-week-3");
});
