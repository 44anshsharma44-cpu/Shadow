'use client';

import React, { useRef, useEffect } from 'react';
import { useGameStore } from '@/stores/GameStore';
import { Boxer } from '@/types/game';
import { CombatRangeManager } from '@/game/CombatRangeManager';
import { gameEngine } from '@/game/GameEngine';
import { PunchReachSystem } from '@/game/PunchReachSystem';
import { handAvatarMapper, HandAvatarPose } from '@/ai/HandAvatarMapper';
import { boxingCameraSystem } from '@/game/BoxingCameraSystem';
import { usePoseStore } from '@/stores/PoseStore';

// ─── Module-level animation state (avoids closure stale-state issues) ─────────
let oppBob    = 0;
let oppDrift  = 0;
let hitFlashTimer = 0;
let lastImpactTime = 0;
let scorePopups: { x: number; y: number; text: string; ttl: number }[] = [];

const CANVAS_W = 800;
const CANVAS_H = 450;

export function GameCanvas() {
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId  = useRef<number | null>(null);
  const store             = useGameStore;

  // Debug mode via URL param
  const isDebug = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('debug') === '1' ||
     new URLSearchParams(window.location.search).get('hitbox') === '1');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time        += 0.016;
      oppBob      += 0.072;
      oppDrift    += 0.038;
      hitFlashTimer = Math.max(0, hitFlashTimer - 1);

      const { player, opponent, status } = store.getState();

      const camera = boxingCameraSystem.update(player, opponent, CANVAS_W, CANVAS_H);

      // ── Camera shake / score popup on new physical contact ─────────────────
      const impact = gameEngine.lastImpact;
      if (impact && impact.time !== lastImpactTime) {
        lastImpactTime = impact.time;
        hitFlashTimer = 8;
        boxingCameraSystem.addImpactShake(impact.attacker === 'player' ? 17 : 12);
        if (impact.attacker === 'player') {
          scorePopups.push({
            x: impact.x,
            y: impact.y - 16,
            text: `+${impact.score}`,
            ttl: 44,
          });
        }
      }
      scorePopups = scorePopups
        .map(p => ({ ...p, y: p.y - 0.7, ttl: p.ttl - 1 }))
        .filter(p => p.ttl > 0);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // ── World-space transform (camera zoom + shake) ────────────────────────
      ctx.save();
      ctx.translate(CANVAS_W / 2 + camera.offsetX + camera.shakeX, CANVAS_H / 2 + camera.offsetY + camera.shakeY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);

      // 1. Background
      drawBackground(ctx, CANVAS_W, CANVAS_H, time);

      // 2. Ring (flat camera, reduced depth)
      drawRing(ctx, CANVAS_W, CANVAS_H, time);

      // 3. Compute screen positions
      const oppScreenX = CombatRangeManager.opponentScreenX(opponent, CANVAS_W);
      const oppScreenY = CombatRangeManager.opponentScreenY(opponent, player, CANVAS_H);
      const oppScale   = CombatRangeManager.opponentScale(opponent, player);
      // 4. Draw opponent (properly scaled, centered)
      drawOpponent(ctx, opponent, oppScreenX, oppScreenY, oppScale, time);

      // 5. Impact effects
      if (opponent.state === 'HIT') {
        hitFlashTimer = 6;
        drawImpactFlash(ctx, impact?.x ?? oppScreenX, impact?.y ?? oppScreenY - 80 * oppScale);
      }
      if (player.state === 'HIT') {
        drawHitVignette(ctx, CANVAS_W, CANVAS_H);
      }

      // 6. Debug hitbox overlay (world-space)
      if (isDebug) {
        const poseGesture = usePoseStore.getState().gesture;
        const punchType   = player.activeAttack?.type ?? opponent.activeAttack?.type ?? null;
        const confidence  = player.activeAttack ? 0.92 : poseGesture !== 'NONE' ? 0.75 : 0;
        PunchReachSystem.drawDebugScene(
          ctx,
          gameEngine.lastPlayerBody,
          gameEngine.lastOpponentBody,
          gameEngine.lastPlayerFist,
          gameEngine.lastOpponentFist,
          gameEngine.lastCollision.player,
          gameEngine.lastCollision.opponent,
          gameEngine.lastDistance,
          punchType,
          confidence
        );
      }

      drawScorePopups(ctx);

      ctx.restore(); // end world-space

      // 7. Player gloves (screen-space, rendered AFTER world restore)
      // handAvatarMapper.lastPose is updated every frame by CameraView
      const avatarPose = handAvatarMapper.lastPose;
      drawPlayerGloves(ctx, player, avatarPose, time);

      // 8. Score popups / lobby
      if (status === 'LOBBY') drawLobbyDim(ctx, CANVAS_W, CANVAS_H);

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current !== null) cancelAnimationFrame(animationFrameId.current);
    };
  }, [store, isDebug]);

  return (
    <div className="relative border border-[#1f2833]/40 bg-black rounded-3xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.8)] aspect-[16/9] w-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-full object-cover block"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
  //  BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    // Base dark fill
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#040508');
    bg.addColorStop(1, '#090b12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Pulsing spotlights
    const p = 0.75 + Math.sin(t * 1.3) * 0.25;
    const spotlight = (x: number, col: string, str: number) => {
      ctx.save();
      const rg = ctx.createRadialGradient(x, 0, 0, x, 0, h * 0.85);
      const hex = Math.round(str * p * 255).toString(16).padStart(2, '0');
      rg.addColorStop(0,    col + hex);
      rg.addColorStop(0.4,  col + '0a');
      rg.addColorStop(1,    'transparent');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x - 160, 0);
      ctx.lineTo(x + 160, 0);
      ctx.lineTo(x + 320, h);
      ctx.lineTo(x - 320, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    spotlight(130, '#45f3ff', 0.12);
    spotlight(w - 130, '#ff007f', 0.12);
    spotlight(w / 2, '#ffffff', 0.06);

    // Crowd silhouette (top 30%)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h * 0.30);
    for (let i = 0; i < 32; i++) {
      const cx = (w / 32) * i + w / 64;
      const cy = h * 0.24 + Math.sin(i * 1.9 + t * 0.5) * 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${12 + (i * 7) % 25},${8 + (i * 5) % 18},28, 0.75)`;
      ctx.fill();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  RING  – FLAT perspective, reduced depth so opponent isn't tiny
  // ─────────────────────────────────────────────────────────────────────────────
  function drawRing(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    // Horizon much lower → ring is flatter → opponent appears larger/closer
    const horizon = h * 0.48;

    // Sky area
    ctx.fillStyle = '#06070d';
    ctx.fillRect(0, 0, w, horizon);

    // Canvas mat gradient
    const mat = ctx.createLinearGradient(0, horizon, 0, h);
    mat.addColorStop(0, '#131525');
    mat.addColorStop(0.5, '#0e1020');
    mat.addColorStop(1, '#08090f');
    ctx.fillStyle = mat;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Very subtle perspective grid (few lines, low opacity)
    ctx.strokeStyle = 'rgba(40,50,65,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const ex = (w / 10) * i;
      ctx.beginPath();
      ctx.moveTo(w / 2, horizon);
      ctx.lineTo(ex, h);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const ratio = i / 3;
      const y     = horizon + Math.pow(ratio, 1.8) * (h - horizon);
      ctx.globalAlpha = 0.15 + ratio * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Center ring circle
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#45f3ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, horizon + 55, 80, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Corner posts (shorter, closer together for flat ring)
    const postX = [[110, horizon - 55, 10, 140], [w - 120, horizon - 55, 10, 140]];
    postX.forEach(([x, y, pw, ph]) => {
      ctx.fillStyle = '#1c2030';
      ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = '#ff007f'; ctx.fillRect(x, y + 8, pw, 14);
      ctx.fillStyle = '#45f3ff'; ctx.fillRect(x, y + 28, pw, 14);
    });

    // Ropes – tighter vertical spread, pulsing glow
    const ropeY   = [-22, 0, 22];
    const ropeCols = ['#45f3ff', '#ffffff', '#ff007f'];
    ropeY.forEach((off, idx) => {
      ctx.save();
      const glow = 0.55 + Math.sin(t * 2.8 + idx * 1.1) * 0.45;
      ctx.strokeStyle = ropeCols[idx];
      ctx.lineWidth   = idx === 1 ? 3 : 2;
      ctx.shadowBlur  = 9 * glow;
      ctx.shadowColor = ropeCols[idx];

      ctx.beginPath();
      ctx.moveTo(115, horizon + off);
      ctx.quadraticCurveTo(w / 2, horizon + off + 4, w - 115, horizon + off);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(115, horizon + off);
      ctx.lineTo(0, horizon + off * 2.2 + 90);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - 115, horizon + off);
      ctx.lineTo(w, horizon + off * 2.2 + 90);
      ctx.stroke();

      ctx.restore();
    });
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  GLOVE helper
  // ─────────────────────────────────────────────────────────────────────────────
  function drawGlove(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    scale: number,
    isLeft: boolean,
    color: string,
    glow: number = 1.0,
    rotation: number = 0
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.strokeStyle = color;
    ctx.fillStyle   = 'rgba(7,8,13,0.92)';
    ctx.lineWidth   = 3.5 * scale;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.shadowBlur  = 20 * glow;
    ctx.shadowColor = color;

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 21 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Thumb
    ctx.beginPath();
    ctx.ellipse(
      isLeft ? -17 * scale : 17 * scale,
      5 * scale,
      9 * scale, 7 * scale,
      isLeft ? 0.4 : -0.4,
      0, Math.PI * 2
    );
    ctx.fill(); ctx.stroke();

    // Cuff
    ctx.beginPath();
    ctx.roundRect(-14 * scale, 16 * scale, 28 * scale, 12 * scale, 3);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  OPPONENT – drawn at proper scale, in center-right screen area
  // ─────────────────────────────────────────────────────────────────────────────
  function drawOpponent(
    ctx: CanvasRenderingContext2D,
    opp: Boxer,
    ox: number, oy: number,
    scale: number,
    t: number
  ) {
    const isHit     = opp.state === 'HIT';
    const isKO      = opp.state === 'KNOCKED_OUT';
    const isBlock   = opp.state === 'BLOCKING';
    const isVictory = opp.state === 'VICTORY';

    // Idle animations
    const bob    = Math.sin(oppBob)    * 4 * scale;
    const drift  = Math.sin(oppDrift)  * 3;

    let bx = ox + drift;
    let by = oy + bob;

    if (isKO) {
      by += 90 * scale;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(0.9);
      ctx.translate(-bx, -by);
    }
    if (isHit) {
      bx += Math.sin(t * 45) * 7;
      by -= 8 * scale;
    }
    if (isVictory) {
      by -= Math.abs(Math.sin(t * 4)) * 25;
    }

    const color = isHit ? '#ffffff' : '#ff007f';

    ctx.save();
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 3.5 * scale;
    ctx.lineCap      = 'round';
    ctx.lineJoin     = 'round';
    ctx.shadowBlur   = isHit ? 30 : 10;
    ctx.shadowColor  = color;

    // Key geometry points
    const headY  = by - 105 * scale;
    const neckY  = by - 83 * scale;
    const chestY = by - 52 * scale;
    const hipY   = by;
    const shL    = { x: bx - 50 * scale, y: chestY - 8 * scale };
    const shR    = { x: bx + 50 * scale, y: chestY - 8 * scale };
    const hipL   = { x: bx - 25 * scale, y: hipY };
    const hipR   = { x: bx + 25 * scale, y: hipY };

    // Torso fill
    const tGrad = ctx.createLinearGradient(bx - 50 * scale, chestY, bx + 50 * scale, chestY);
    tGrad.addColorStop(0, 'rgba(18,8,26,0.88)');
    tGrad.addColorStop(0.5, 'rgba(28,10,42,0.94)');
    tGrad.addColorStop(1, 'rgba(18,8,26,0.88)');
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.moveTo(shL.x, shL.y);
    ctx.lineTo(shR.x, shR.y);
    ctx.lineTo(hipR.x, hipR.y);
    ctx.lineTo(hipL.x, hipL.y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Centre spine
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(bx, chestY - 5 * scale);
    ctx.lineTo(bx, hipY - 5 * scale);
    ctx.stroke();
    ctx.restore();

    // Head / helmet
    ctx.fillStyle = 'rgba(15,6,24,0.94)';
    ctx.beginPath();
    ctx.arc(bx, headY, 23 * scale, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Visor bar
    ctx.save();
    ctx.strokeStyle = isHit ? '#ff3333' : '#e0e0ff';
    ctx.lineWidth   = 3.2 * scale;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(bx - 18 * scale, headY + 1 * scale);
    ctx.lineTo(bx + 18 * scale, headY + 1 * scale);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth   = 9 * scale;
    ctx.stroke();
    ctx.restore();

    // Neck
    ctx.beginPath();
    ctx.moveTo(bx - 7 * scale, headY + 21 * scale);
    ctx.lineTo(bx - 7 * scale, neckY);
    ctx.moveTo(bx + 7 * scale, headY + 21 * scale);
    ctx.lineTo(bx + 7 * scale, neckY);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(hipL.x, hipL.y);
    ctx.lineTo(bx - 36 * scale, hipY + 52 * scale);
    ctx.moveTo(hipR.x, hipR.y);
    ctx.lineTo(bx + 36 * scale, hipY + 52 * scale);
    ctx.stroke();

    // Foot shadows
    [bx - 32 * scale, bx + 32 * scale].forEach(fx => {
      ctx.fillStyle = color + '33';
      ctx.beginPath();
      ctx.ellipse(fx, hipY + 54 * scale, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Fist positions ────────────────────────────────────────────────────────
    let fL = { x: bx - 33 * scale, y: headY + 26 * scale };
    let fR = { x: bx + 33 * scale, y: headY + 26 * scale };
    let sL = scale, sR = scale;

    if (isBlock) {
      fL = { x: bx - 12 * scale, y: headY - 7 * scale };
      fR = { x: bx + 12 * scale, y: headY - 7 * scale };
    } else if (isHit) {
      fL = { x: bx - 90 * scale, y: chestY + 22 * scale };
      fR = { x: bx + 90 * scale, y: chestY + 22 * scale };
    } else if (isVictory) {
      fL = { x: bx - 50 * scale, y: headY - 72 * scale };
      fR = { x: bx + 50 * scale, y: headY - 72 * scale };
    } else if (opp.activeAttack) {
      const { type, progress } = opp.activeAttack;
      // Use same PunchReachSystem peak calculation for visual consistency
      const peakAt = type === 'jab' ? 0.45 : type === 'hook' ? 0.5 : 0.45;
      const reach  = Math.sin(Math.min(progress / peakAt, 1.0) * Math.PI * 0.5);

      // Target points = toward camera (player glove area ~center-bottom)
      if (type === 'jab') {
        fL.x = lerp(bx - 33 * scale, CANVAS_W * 0.42, reach);
        fL.y = lerp(headY + 26 * scale, CANVAS_H * 0.60, reach);
        sL   = scale * lerp(1.0, 2.4, reach);
      } else if (type === 'hook') {
        fR.x = lerp(bx + 33 * scale, CANVAS_W * 0.46, reach);
        fR.y = lerp(headY + 26 * scale, CANVAS_H * 0.56, reach);
        sR   = scale * lerp(1.0, 2.6, reach);
      } else {
        fL.x = lerp(bx - 33 * scale, CANVAS_W * 0.44, reach);
        fL.y = lerp(headY + 26 * scale, headY - 50 * scale, reach);
        sL   = scale * lerp(1.0, 2.8, reach);
      }
    } else {
      // Idle sway
      const sw = Math.sin(oppDrift * 0.65) * 2.5 * scale;
      fL.y += sw; fR.y -= sw;
    }

    // Arms
    const drawArm = (sh: { x: number; y: number }, f: { x: number; y: number }, left: boolean) => {
      const ex = sh.x * 0.5 + f.x * 0.5 + (left ? -10 * scale : 10 * scale);
      const ey = Math.min(sh.y, f.y) + Math.abs(sh.y - f.y) * 0.35 + 8 * scale;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.quadraticCurveTo(ex, ey, f.x, f.y);
      ctx.stroke();
    };
    drawArm(shL, fL, true);
    drawArm(shR, fR, false);

    drawGlove(ctx, fL.x, fL.y, sL, true,  isHit ? '#ffffff' : '#ff007f', isHit ? 2.0 : 1.0);
    drawGlove(ctx, fR.x, fR.y, sR, false, isHit ? '#ffffff' : '#ff007f', isHit ? 2.0 : 1.0);

    if (isKO) ctx.restore();
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  PLAYER GLOVES – 1st person, mapped from webcam via BodyToAvatarMapper
  // ─────────────────────────────────────────────────────────────────────────────
function drawPlayerGloves(
    ctx: CanvasRenderingContext2D,
    player: Boxer,
    avatarPose: HandAvatarPose,
    t: number
  ) {
    if (player.state === 'KNOCKED_OUT') return;

    const isHit     = player.state === 'HIT';
    const isVictory = player.state === 'VICTORY';
    const color     = isHit ? '#ffffff' : '#45f3ff';

    // Base positions from avatar mapper (webcam-driven) or defaults
    let rX = avatarPose.rightGlove.x;
    let rY = avatarPose.rightGlove.y;
    let lX = avatarPose.leftGlove.x;
    let lY = avatarPose.leftGlove.y;
    let sL = avatarPose.leftGlove.scale;
    let sR = avatarPose.rightGlove.scale;
    let rotL = avatarPose.leftGlove.rotation;
    let rotR = avatarPose.rightGlove.rotation;
    let glowL = 1.0, glowR = 1.0;

    // Override positions during game-driven animations
    if (player.state === 'BLOCKING') {
      rX = 330; rY = 250; lX = 470; lY = 250;
      sL = 1.18; sR = 1.18;
    } else if (isVictory) {
      rX = 215; rY = 140 + Math.sin(t * 300) * 18;
      lX = 585; lY = 140 + Math.cos(t * 300) * 18;
      glowL = 2.2; glowR = 2.2;
    } else if (player.activeAttack) {
      const { type, progress } = player.activeAttack;
      const peakAt = type === 'jab' ? 0.45 : 0.5;
      const reach  = Math.sin(Math.min(progress / peakAt, 1.0) * Math.PI * 0.5);
      const fist = gameEngine.lastPlayerFist;
      glowL = 1 + reach * 1.8;
      glowR = 1 + reach * 1.8;

      if (type === 'jab') {
        // Right jab: drawn at the same virtual fist used by collision.
        rX = lerp(rX, fist?.x ?? CANVAS_W * 0.55, reach);
        rY = lerp(rY, fist?.y ?? CANVAS_H * 0.42, reach);
        sR = lerp(sR, 2.35, reach);
        rotR = lerp(rotR, 0, reach * 0.5);
      } else if (type === 'hook') {
        // Left hook: visual glove follows the physical arcing fist.
        lX = lerp(lX, fist?.x ?? CANVAS_W * 0.50, reach);
        lY = lerp(lY, fist?.y ?? CANVAS_H * 0.44, reach);
        sL = lerp(sL, 2.45, reach);
        rotL = reach * 0.5;
      } else {
        // Uppercut: shorter forward travel with visible rising contact.
        rX = lerp(rX, fist?.x ?? CANVAS_W * 0.46, reach);
        rY = lerp(rY, fist?.y ?? CANVAS_H * 0.28, reach);
        sR = lerp(sR, 2.55, reach);
      }
    }

    // IK arm lines. These keep the gloves visually attached to shoulders.
    ctx.save();
    ctx.strokeStyle = color + '50';
    ctx.lineWidth   = 13;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(avatarPose.rightArm.shoulder.x, avatarPose.rightArm.shoulder.y);
    ctx.lineTo(avatarPose.rightArm.elbow.x, avatarPose.rightArm.elbow.y);
    ctx.lineTo(rX, rY + 18 * sR);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(avatarPose.leftArm.shoulder.x, avatarPose.leftArm.shoulder.y);
    ctx.lineTo(avatarPose.leftArm.elbow.x, avatarPose.leftArm.elbow.y);
    ctx.lineTo(lX, lY + 18 * sL);
    ctx.stroke();
    ctx.restore();

    drawGlove(ctx, rX, rY, sR * 1.3, false, color, glowR, rotR);
    drawGlove(ctx, lX, lY, sL * 1.3, true,  color, glowL, rotL);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  IMPACT FX
  // ─────────────────────────────────────────────────────────────────────────────
  function drawImpactFlash(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    const rays = 10;
    for (let i = 0; i < rays; i++) {
      const a   = (i / rays) * Math.PI * 2 + Math.random() * 0.35;
      const len = 20 + Math.random() * 28;
      ctx.strokeStyle = `rgba(255,${170 + Math.random() * 85},0,0.9)`;
      ctx.lineWidth   = 1.5 + Math.random() * 3;
      ctx.shadowBlur  = 18; ctx.shadowColor = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.shadowBlur  = 55; ctx.shadowColor = '#ffffff';
    ctx.fillStyle   = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHitVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w * 0.78);
    g.addColorStop(0, 'rgba(255,0,80,0)');
    g.addColorStop(0.6, 'rgba(255,0,80,0.12)');
    g.addColorStop(1, 'rgba(255,0,80,0.60)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawScorePopups(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    for (const popup of scorePopups) {
      const alpha = Math.min(1, popup.ttl / 22);
      ctx.fillStyle = `rgba(255, 238, 120, ${alpha})`;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ffcc00';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
  }

  function drawLobbyDim(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

export default GameCanvas;
