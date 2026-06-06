# Shadow Boxing AI

Shadow Boxing AI is a complete, production-ready web application inspired by Shadow Cricket, where a user's real-world shadow-boxing movements are tracked through their webcam and translated into actions inside an interactive boxing game.

Utilizing Next.js 15, MediaPipe Pose Landmarker, Tailwind CSS, Zustand, and Prisma, the system detects boxing movements (Jabs, Hooks, Uppercuts, Ducks, and Blocks) in real-time, matching them to actions performed by a virtual boxer against a FSM-based AI opponent.

---

## ⚡ Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **AI Tracking**: MediaPipe Tasks Vision, BlazePose Full Body Tracking
- **Graphics Rendering**: HTML5 Canvas (60 FPS requestAnimationFrame loop)
- **Database / Backing**: SQLite (for zero-config local development), Prisma ORM
- **Authentication**: NextAuth (Credentials provider + Guest Quickplay Mode)
- **Sound Design**: Synthesized sound effects via Web Audio API (Zero external MP3 dependencies)

---

## 🛠️ Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

### Configuration Details

| Variable | Description | Recommended Local Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Prisma SQLite database connection string. | `"file:./dev.db"` |
| `NEXTAUTH_URL` | Canonical app URL for NextAuth callbacks. | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth cryptographic signing token. | `localdevelopmentsecretfornextauth32charslong` |
| `NEXT_PUBLIC_APP_URL` | Frontend canonical URL. | `http://localhost:3000` |
| `NEXT_PUBLIC_MEDIAPIPE_MODEL_URL` | MediaPipe model asset CDN path. | Google Storage CDN (preloaded) |

---

## 🚀 Setup & Local Development

To run the project locally on your machine, follow these steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database & Client
Run the Prisma migrations to create the local SQLite database file `prisma/dev.db` and generate the type-safe Prisma client:
```bash
npx prisma migrate dev --name init
```

### 3. Launch Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Running Automated Tests

We use Vitest to run unit tests for the classifier and combat systems:

```bash
npm run test
```

---

## 🐳 Docker Deployment

To run the application inside a containerized production environment:

### 1. Build and Launch Container
```bash
docker-compose up -d --build
```
This builds a multi-stage optimized Alpine container (~180MB) and mounts a volume for database persistence.

### 2. Stop Containers
```bash
docker-compose down
```

---

## ☁️ Vercel Deployment

Since the app uses Next.js, it is 100% deployable to Vercel:

1. **Prisma SQLite Warning**: SQLite is file-based and ephemeral on Vercel. For production, switch the provider in `prisma/schema.prisma` to `postgresql` or `mysql` and update `DATABASE_URL` to target an online host (like Supabase, Neon, or Aiven).
2. **Setup**:
   - Push your code to a GitHub repository.
   - Import the project into Vercel.
   - Configure Environment Variables (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`).
3. **Build Command**: Set the Vercel build command to:
   ```bash
   npx prisma generate && next build
   ```

---

## 🩺 Troubleshooting

### 1. Webcam permission denied
Ensure your browser page has permissions to access the webcam. Look for the camera icon in your address bar to toggle access.

### 2. Gesture classification feels slow or unresponsive
Go to the **Settings** page and slide the **Pose Sensitivity** slider up. High sensitivity lowers the velocity thresholds, making swift or lighter movements easier to register.

### 3. Canvas rendering lags
Ensure hardware acceleration is enabled in your browser. The MediaPipe Pose tracker uses WebGL GPU delegation for fast frame analysis.
