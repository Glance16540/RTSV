// Looking out at the sky in a match: where the camera turns, and how it goes down and comes back.
import { describe, expect, it } from 'vitest';
import { LOW, Outlook, lightBearing, shortTurn } from '../src/client/outlook';
import type { Renderer } from '../src/client/renderer';

const YAW = Math.PI / 4, PITCH = 0.87, HOME = { yaw: YAW, pitch: PITCH };
const fake = () => ({ cine: null } as unknown as Renderer);

describe('looking out', () => {
  it('faces the sunrise at dawn, the sunset at dusk, and the moon by night', () => {
    const dawn = lightBearing(0), dusk = lightBearing(0.66), night = lightBearing(0.8);
    expect(dawn.moon).toBe(false);
    expect(dusk.moon).toBe(false);
    expect(night.moon).toBe(true);
    // Dawn and dusk lie on opposite sides: the sun has crossed the sky between them.
    expect(Math.abs(shortTurn(dawn.yaw, dusk.yaw))).toBeGreaterThan(1.5);
    expect(Math.sin(dawn.yaw)).toBeGreaterThan(0);
    expect(Math.sin(dusk.yaw)).toBeLessThan(0);
  });

  it('comes down to stand low and goes back to the game\'s own view', () => {
    const r = fake(), o = new Outlook(r, HOME, () => 0.3);
    o.update(0.1);
    expect(r.cine).toBeNull();
    expect(o.toggle()).toBe(true);
    for (let i = 0; i < 30; i++) o.update(0.1);
    expect(r.cine!.pitch).toBeCloseTo(LOW, 5);
    expect(Math.abs(shortTurn(r.cine!.yaw, lightBearing(0.3).yaw))).toBeLessThan(0.01);
    o.toggle();
    o.update(0.3);
    expect(r.cine!.pitch).toBeGreaterThan(LOW);
    expect(r.cine!.pitch).toBeLessThan(PITCH);
    for (let i = 0; i < 30; i++) o.update(0.1);
    expect(r.cine).toBeNull();
  });

  it('turns and raises the eyes only while looking out, and leaves the menu\'s camera alone', () => {
    const r = fake(), o = new Outlook(r, HOME, () => 0.8);
    expect(o.turn(1)).toBe(false);
    expect(o.wheel(-1)).toBe(false);
    r.cine = { yaw: 1, pitch: 0.13 };
    expect(o.toggle()).toBe(false);
    r.cine = null;
    o.toggle();
    for (let i = 0; i < 20; i++) o.update(0.1);
    const before = r.cine!.yaw, gaze = r.cine!.gaze!;
    expect(o.turn(1)).toBe(true);
    expect(o.wheel(-1)).toBe(true);
    for (let i = 0; i < 40; i++) o.update(0.1);
    expect(shortTurn(before, r.cine!.yaw)).toBeCloseTo(0.22, 2);
    expect(r.cine!.gaze!).toBeCloseTo(gaze + 0.05, 2);
  });
});
