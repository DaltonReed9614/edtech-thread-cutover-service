import { z } from "zod";
import { InfraiClient } from "./infrai";

export const threadEventSchema = z.object({
  courseId: z.string().min(1),
  courseName: z.string().min(1),
  deliveryMode: z.enum(["cohort", "self_paced"]),
  threadId: z.string().min(1),
  learnerId: z.string().min(1),
  learnerName: z.string().min(1),
  educatorId: z.string().min(1),
  dueAtIso: z.string().datetime(),
  nowIso: z.string().datetime(),
  hasSubmitted: z.boolean(),
  event: z.enum(["typing.started", "typing.stopped", "message.read"])
});

export type ThreadEventRequest = z.infer<typeof threadEventSchema>;

export type ThreadDecision = {
  channel: string;
  learnerStatus: "on_track" | "at_risk";
  educatorReport: string;
  publishEvent: string;
  publishData: string;
};

export function buildThreadDecision(input: ThreadEventRequest): ThreadDecision {
  const channel = `course.${input.courseId}.thread.${input.threadId}`;
  const dueAt = new Date(input.dueAtIso).getTime();
  const now = new Date(input.nowIso).getTime();
  const pastDeadline = now > dueAt;
  const learnerStatus = pastDeadline && !input.hasSubmitted ? "at_risk" : "on_track";

  let educatorReport = `${input.learnerName} is active in ${input.courseName}.`;

  if (input.event === "typing.started") {
    educatorReport = `${input.learnerName} is typing in the thread for ${input.courseName}. Status: ${learnerStatus}.`;
  }

  if (input.event === "typing.stopped") {
    educatorReport = `${input.learnerName} stopped typing in the thread for ${input.courseName}. Status: ${learnerStatus}.`;
  }

  if (input.event === "message.read") {
    educatorReport = learnerStatus === "at_risk"
      ? `${input.learnerName} read the thread but is at risk after the deadline in ${input.courseName}.`
      : `${input.learnerName} read the thread and is on track in ${input.courseName}.`;
  }

  const publishData = JSON.stringify({
    learnerId: input.learnerId,
    learnerName: input.learnerName,
    educatorId: input.educatorId,
    deliveryMode: input.deliveryMode,
    dueAtIso: input.dueAtIso,
    nowIso: input.nowIso,
    hasSubmitted: input.hasSubmitted,
    learnerStatus,
    educatorReport
  });

  return {
    channel,
    learnerStatus,
    educatorReport,
    publishEvent: input.event,
    publishData
  };
}

export async function handleThreadEvent(args: {
  infraiKey: string;
  request: ThreadEventRequest;
  accountId?: string;
}): Promise<{
  learnerStatus: "on_track" | "at_risk";
  educatorReport: string;
  channel: string;
  token: unknown;
  presence: unknown;
}> {
  const parsed = threadEventSchema.parse(args.request);
  const decision = buildThreadDecision(parsed);
  const infrai = new InfraiClient(args.infraiKey);

  await infrai.realtime.channel.create({
    channel: decision.channel,
    type: "presence"
  });

  await infrai.realtime.publish({
    channel: decision.channel,
    event: decision.publishEvent,
    data: decision.publishData,
    account_id: args.accountId
  });

  const token = await infrai.realtime.token.issue({
    client_id: parsed.learnerId,
    channels: [decision.channel],
    capabilities: ["publish", "subscribe", "presence"],
    ttl_seconds: 900
  });

  const presence = await infrai.realtime.presence.get(decision.channel);

  return {
    learnerStatus: decision.learnerStatus,
    educatorReport: decision.educatorReport,
    channel: decision.channel,
    token: token.data,
    presence: presence.data
  };
}
