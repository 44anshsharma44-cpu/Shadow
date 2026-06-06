import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch paginated high scores
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const [scores, total] = await Promise.all([
      prisma.highScore.findMany({
        orderBy: { score: 'desc' },
        take: limit,
        skip: skip,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.highScore.count(),
    ]);

    const formattedScores = scores.map((s, idx) => ({
      id: s.id,
      rank: skip + idx + 1,
      score: s.score,
      userName: s.user.name || s.user.email.split('@')[0],
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({
      scores: formattedScores,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Leaderboard GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 });
  }
}

// POST: Save new score and game session
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { score, duration, accuracy, comboCount, result } = await req.json();

    if (score === undefined || result === undefined) {
      return NextResponse.json({ error: 'Invalid game session data.' }, { status: 400 });
    }

    // Save score and session in a transaction
    const record = await prisma.$transaction(async (tx) => {
      // 1. Create game session
      const gameSession = await tx.gameSession.create({
        data: {
          userId,
          duration: Number(duration),
          accuracy: Number(accuracy),
          comboCount: Number(comboCount),
          score: Number(score),
          result,
        },
      });

      // 2. Check if this is a personal high score or just insert high score record
      const highestScore = await tx.highScore.findFirst({
        where: { userId },
        orderBy: { score: 'desc' },
      });

      let isNewHigh = false;
      if (!highestScore || score > highestScore.score) {
        isNewHigh = true;
        await tx.highScore.create({
          data: {
            userId,
            score: Number(score),
          },
        });
      }

      return { gameSession, isNewHigh };
    });

    return NextResponse.json({
      message: 'Game session saved successfully!',
      session: record.gameSession,
      isNewHigh: record.isNewHigh,
    });
  } catch (err) {
    console.error('Leaderboard POST error:', err);
    return NextResponse.json({ error: 'Failed to save game session.' }, { status: 500 });
  }
}
