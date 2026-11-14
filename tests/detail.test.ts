import { describe, expect, it } from 'vitest';
import { chooseDetail, weakMachine } from '../src/client/detail';

describe('how finely the campaign map is drawn', () => {
  it('a machine that draws in software, is small, or was slow before is one to spare', () => {
    expect(weakMachine({})).toBe(false); // a browser that says nothing is treated as able
    expect(weakMachine({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', cores: 12, memory: 8, maxTexture: 16384 })).toBe(false);
    expect(weakMachine({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)', cores: 16 })).toBe(true);
    expect(weakMachine({ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })).toBe(true);
    expect(weakMachine({ renderer: 'Microsoft Basic Render Driver' })).toBe(true);
    expect(weakMachine({ cores: 2 })).toBe(true);
    expect(weakMachine({ cores: 4, memory: 2 })).toBe(true);
    expect(weakMachine({ cores: 8, maxTexture: 2048 })).toBe(true);
    expect(weakMachine({ cores: 8, memory: 8, slow: true })).toBe(true);
  });

  it('what is typed into the address comes first, then the setting, then the guess', () => {
    const strong = { cores: 12, memory: 8 }, weak = { cores: 2 };
    expect(chooseDetail(null, 'auto', strong)).toBe('high');
    expect(chooseDetail(null, 'auto', weak)).toBe('low');
    expect(chooseDetail(null, 'high', weak)).toBe('high');
    expect(chooseDetail(null, 'low', strong)).toBe('low');
    expect(chooseDetail('low', 'high', strong)).toBe('low');
    expect(chooseDetail('high', 'low', weak)).toBe('high');
    expect(chooseDetail('nonsense', 'auto', strong)).toBe('high');
  });
});
