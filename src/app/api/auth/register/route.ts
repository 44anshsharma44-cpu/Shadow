import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 400 }
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user and associate default settings in a single transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name || null,
          email: normalizedEmail,
          password: hashedPassword,
        },
      });

      await tx.settings.create({
        data: {
          userId: user.id,
          difficulty: 'MEDIUM',
          volume: 0.5,
          sensitivity: 0.5,
          cameraId: '',
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        message: 'Account created successfully!',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { error: 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}
