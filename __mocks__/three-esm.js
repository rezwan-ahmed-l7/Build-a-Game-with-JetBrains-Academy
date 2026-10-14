import { jest } from '@jest/globals';

// ESM-compatible mock for the `three` package used by Renderer.js
// Provides a mocked WebGLRenderer with the methods our tests assert on.
export const WebGLRenderer = jest.fn(() => ({
  setPixelRatio: jest.fn(),
  setSize: jest.fn(),
}));

// Default export to support `import * as THREE from 'three'` usage patterns.
const defaultExport = { WebGLRenderer };
export default defaultExport;
