import { NextResponse } from 'next/server';

interface CoachRequest {
  result: 'WIN' | 'LOSS' | 'DRAW';
  score: number;
  accuracy: number;
  maxCombo: number;
  duration: number;
}

export async function POST(req: Request) {
  try {
    const { result, score, accuracy, maxCombo, duration } = (await req.json()) as CoachRequest;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
      // 1. Call Gemini API
      const prompt = `You are Mickey, a gruff, gravelly-voiced, old-school boxing trainer (similar to Mickey from Rocky). Critique the shadow-boxing session of the user (referred to as "kid") based on these statistics:
- Result: ${result}
- Score: ${score} points
- Punch Accuracy: ${accuracy}%
- Max Combo: ${maxCombo} hits
- Round Duration: ${duration} seconds

Provide a short, punchy 2-to-3 sentence quote. Be tough, direct, call them kid, show tough-love, but keep it highly motivational. Do not use markdown bolding, stars, or italics inside the text. Keep it raw and conversational.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 100,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const feedback = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (feedback) {
          return NextResponse.json({ critique: feedback.trim() });
        }
      }
      console.warn('Gemini API call failed, falling back to local coach rules.');
    }

    // 2. High-fidelity Local Rule-based Coach Fallback
    let critique = '';
    if (result === 'WIN') {
      const winQuotes = [
        `You ate him alive out there, kid! That score of ${score} points proves you got the lightning in your fists. Next time, work on keeping that accuracy above ${Math.max(accuracy, 75)}% and he won't even see the hook coming!`,
        `That's what I'm talkin' about, kid! A win's a win, but don't get lazy on me. You hit a ${maxCombo}-punch combo, now let's double it in the next round. Get some water and let's go again!`,
        `Not bad, kid, not bad at all. You showed real heart in those ${duration} seconds. But keep your guard up when you throw that uppercut, you're leaving your chin wide open!`
      ];
      critique = winQuotes[Math.floor(Math.random() * winQuotes.length)];
    } else if (result === 'LOSS') {
      const lossQuotes = [
        `Get up, kid! You got knocked down, but the fight ain't over till you stop swinging. ${accuracy}% accuracy is too sloppy, you're punching the wind! Keep your eyes on his chest and focus!`,
        `Fists up, kid! You let him walk you into the corner out there. You only got a max combo of ${maxCombo} hits before you lost your guard. We're going back to the heavy bag to drill those hooks!`,
        `Tough break, kid, but pain is the best teacher. You survived ${duration} seconds but you gotta move your feet and duck those hooks! Rub some dirt on it, get back in there, and show me what you're made of!`
      ];
      critique = lossQuotes[Math.floor(Math.random() * lossQuotes.length)];
    } else {
      critique = `A draw? A draw is like kissin' your sister, kid! ${score} points means you worked, but you didn't finish the job. Keep your hands near your nose and let's throw more jabs to break the tie next time!`;
    }

    return NextResponse.json({ critique });
  } catch (e) {
    console.error('AI Coach Route Error:', e);
    return NextResponse.json(
      { critique: "Fists up, kid! Get back in the ring and show me some speed." },
      { status: 500 }
    );
  }
}
