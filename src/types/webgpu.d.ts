/**
 * Minimal WebGPU type declarations for navigator.gpu.
 * Prevents TS2339 errors when probing WebGPU support at runtime.
 */

interface GPUAdapterLimits {
  maxBufferSize: number;
  [key: string]: number;
}

interface GPUAdapterInfoWeb {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface GPUAdapter {
  readonly limits: GPUAdapterLimits;
  readonly info?: GPUAdapterInfoWeb;
  requestDevice(descriptor?: Record<string, unknown>): Promise<GPUDevice>;
}

interface GPUDevice extends EventTarget {
  readonly limits: GPUAdapterLimits;
  destroy(): void;
}

interface GPU {
  requestAdapter(options?: {
    powerPreference?: "low-power" | "high-performance";
  }): Promise<GPUAdapter | null>;
}

interface Navigator {
  readonly gpu?: GPU;
}
