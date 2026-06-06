import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Fetch user sessions, highest score, and basic details
    const [user, sessions, highestScore] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, createdAt: true },
      }),
      prisma.gameSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.highScore.findFirst({
        where: { userId },
        orderBy: { score: 'desc' },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Compute stats
    const totalMatches = sessions.length;
    const wins = sessions.filter((s) => s.result === 'WIN').length;
    const losses = sessions.filter((s) => s.result === 'LOSS').length;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    const avgAccuracy =
      totalMatches > 0
        ? Math.round(
            sessions.reduce((acc, curr) => acc + curr.accuracy, 0) / totalMatches
          )
        : 0;

    const bestCombo =
      totalMatches > 0 ? Math.max(...sessions.map((s) => s.comboCount)) : 0;

    const stats = {
      name: user.name || user.email.split('@')[0],
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      totalMatches,
      wins,
      losses,
      winRate,
      accuracy: avgAccuracy,
      bestCombo,
      highestScore: highestScore?.score || 0,
      history: sessions.map((s) => ({
        id: s.id,
        score: s.score,
        accuracy: s.accuracy,
        comboCount: s.comboCount,
        result: s.result,
        duration: Math.round(s.duration),
        createdAt: s.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error('Profile GET error:', err);
    return NextResponse.json({ error: 'Failed to retrieve profile data.' }, { status: 500 });
  }
}
