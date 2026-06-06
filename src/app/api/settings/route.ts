import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Retrieve user settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    let settings = await prisma.settings.findUnique({
      where: { userId },
    });

    // Fallback if settings don't exist yet
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          userId,
          difficulty: 'MEDIUM',
          volume: 0.5,
          sensitivity: 0.5,
          cameraId: '',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('Settings GET error:', err);
    return NextResponse.json({ error: 'Failed to retrieve settings.' }, { status: 500 });
  }
}

// POST: Update user settings
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { difficulty, volume, sensitivity, cameraId } = await req.json();

    const updatedSettings = await prisma.settings.upsert({
      where: { userId },
      update: {
        difficulty: difficulty !== undefined ? difficulty : undefined,
        volume: volume !== undefined ? Number(volume) : undefined,
        sensitivity: sensitivity !== undefined ? Number(sensitivity) : undefined,
        cameraId: cameraId !== undefined ? cameraId : undefined,
      },
      create: {
        userId,
        difficulty: difficulty || 'MEDIUM',
        volume: volume !== undefined ? Number(volume) : 0.5,
        sensitivity: sensitivity !== undefined ? Number(sensitivity) : 0.5,
        cameraId: cameraId || '',
      },
    });

    return NextResponse.json({
      message: 'Settings updated successfully!',
      settings: updatedSettings,
    });
  } catch (err) {
    console.error('Settings POST error:', err);
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
  }
}
