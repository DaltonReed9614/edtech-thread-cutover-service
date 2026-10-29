import { handleThreadEvent } from "./receipt_sender";

async function main(): Promise<void> {
  const infraiKey = process.env.INFRAI_API_KEY;

  if (!infraiKey) {
    throw new Error("Set INFRAI_API_KEY before running the example.");
  }

  const result = await handleThreadEvent({
    infraiKey,
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
    },
    accountId: "school-west"
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
