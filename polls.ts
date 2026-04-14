import { Router, type Request, type Response } from "express";
import { db, pollsTable, pollOptionsTable, pollVotesTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  CreatePollBody,
  GetPollParams,
  DeletePollParams,
  SubmitVoteParams,
  SubmitVoteBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const polls = await db
    .select({
      id: pollsTable.id,
      question: pollsTable.question,
      createdAt: pollsTable.createdAt,
      totalVotes: sql<number>`COALESCE(SUM(${pollOptionsTable.voteCount}), 0)::int`,
    })
    .from(pollsTable)
    .leftJoin(pollOptionsTable, eq(pollOptionsTable.pollId, pollsTable.id))
    .groupBy(pollsTable.id)
    .orderBy(desc(pollsTable.createdAt));

  res.json(polls);
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreatePollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { question, options } = parsed.data;

  const [poll] = await db.insert(pollsTable).values({ question }).returning();

  await db.insert(pollOptionsTable).values(
    options.map((text) => ({ pollId: poll.id, text }))
  );

  const fullPoll = {
    id: poll.id,
    question: poll.question,
    createdAt: poll.createdAt,
    totalVotes: 0,
  };

  res.status(201).json(fullPoll);
});

router.get("/stats/summary", async (req: Request, res: Response): Promise<void> => {
  const totalPollsResult = await db.select({ count: sql<number>`COUNT(*)::int` }).from(pollsTable);
  const totalVotesResult = await db.select({ count: sql<number>`COALESCE(SUM(vote_count), 0)::int` }).from(pollOptionsTable);

  const pollsWithVotes = await db
    .select({
      id: pollsTable.id,
      question: pollsTable.question,
      createdAt: pollsTable.createdAt,
      totalVotes: sql<number>`COALESCE(SUM(${pollOptionsTable.voteCount}), 0)::int`,
    })
    .from(pollsTable)
    .leftJoin(pollOptionsTable, eq(pollOptionsTable.pollId, pollsTable.id))
    .groupBy(pollsTable.id)
    .orderBy(desc(pollsTable.createdAt));

  const mostVotedPoll = pollsWithVotes.reduce<typeof pollsWithVotes[0] | null>((best, p) => {
    if (!best || p.totalVotes > best.totalVotes) return p;
    return best;
  }, null);

  const recentPolls = pollsWithVotes.slice(0, 5);

  res.json({
    totalPolls: totalPollsResult[0]?.count ?? 0,
    totalVotes: totalVotesResult[0]?.count ?? 0,
    mostVotedPoll: mostVotedPoll && mostVotedPoll.totalVotes > 0 ? mostVotedPoll : null,
    recentPolls,
  });
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetPollParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid poll ID" });
    return;
  }

  const { id } = parsed.data;

  const [poll] = await db
    .select({
      id: pollsTable.id,
      question: pollsTable.question,
      createdAt: pollsTable.createdAt,
      totalVotes: sql<number>`COALESCE(SUM(${pollOptionsTable.voteCount}), 0)::int`,
    })
    .from(pollsTable)
    .leftJoin(pollOptionsTable, eq(pollOptionsTable.pollId, pollsTable.id))
    .groupBy(pollsTable.id)
    .where(eq(pollsTable.id, id));

  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const options = await db
    .select()
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.pollId, id));

  res.json({ ...poll, options });
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = DeletePollParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid poll ID" });
    return;
  }

  const { id } = parsed.data;

  await db.delete(pollsTable).where(eq(pollsTable.id, id));
  res.json({ success: true });
});

router.post("/:id/vote", async (req: Request, res: Response): Promise<void> => {
  const paramsParsed = SubmitVoteParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid poll ID" });
    return;
  }

  const bodyParsed = SubmitVoteBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { id } = paramsParsed.data;
  const { optionId, voterToken } = bodyParsed.data;

  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id));
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const [option] = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.id, optionId));
  if (!option || option.pollId !== id) {
    res.status(400).json({ error: "Invalid option for this poll" });
    return;
  }

  try {
    await db.insert(pollVotesTable).values({ pollId: id, optionId, voterToken });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      res.status(400).json({ error: "You have already voted on this poll" });
      return;
    }
    throw err;
  }

  await db
    .update(pollOptionsTable)
    .set({ voteCount: sql`${pollOptionsTable.voteCount} + 1` })
    .where(eq(pollOptionsTable.id, optionId));

  const updatedOptions = await db
    .select()
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.pollId, id));

  const totalVotes = updatedOptions.reduce((sum, o) => sum + o.voteCount, 0);

  res.json({
    id: poll.id,
    question: poll.question,
    createdAt: poll.createdAt,
    totalVotes,
    options: updatedOptions,
  });
});

export default router;
