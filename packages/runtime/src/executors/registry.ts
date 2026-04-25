/**
 * Executor registry for managing different execution targets.
 */

import type { ExecutionTarget } from "@bands/format";
import type { Executor, ExecutorFactory, ExecutorOptions, ExecutorRegistry } from "./types";

class ExecutorRegistryImpl implements ExecutorRegistry {
  private factories = new Map<ExecutionTarget, ExecutorFactory>();
  private instances = new Map<ExecutionTarget, Executor>();

  register(target: ExecutionTarget, factory: ExecutorFactory): void {
    this.factories.set(target, factory);
  }

  get(target: ExecutionTarget): ExecutorFactory | undefined {
    return this.factories.get(target);
  }

  create(target: ExecutionTarget, options?: ExecutorOptions): Executor | undefined {
    const factory = this.factories.get(target);
    if (!factory) return undefined;

    // Cache instances by target
    const cacheKey = target;
    let executor = this.instances.get(cacheKey);
    if (!executor) {
      executor = factory(options);
      this.instances.set(cacheKey, executor);
    }
    return executor;
  }

  async listAvailable(): Promise<ExecutionTarget[]> {
    const available: ExecutionTarget[] = [];

    for (const [target, factory] of this.factories) {
      const executor = factory();
      if (await executor.isAvailable()) {
        available.push(target);
      }
    }

    return available;
  }

  /** Clear cached instances (useful for testing) */
  clearCache(): void {
    this.instances.clear();
  }
}

/** Global executor registry */
export const executorRegistry = new ExecutorRegistryImpl();

/**
 * Get an executor for the given target, or throw if not available.
 */
export async function getExecutor(
  target: ExecutionTarget,
  options?: ExecutorOptions
): Promise<Executor> {
  const executor = executorRegistry.create(target, options);
  if (!executor) {
    throw new Error(`No executor registered for target: ${target}`);
  }

  if (!(await executor.isAvailable())) {
    throw new Error(`Executor for target '${target}' is not available. ${getHelpText(target)}`);
  }

  return executor;
}

function getHelpText(target: ExecutionTarget): string {
  switch (target) {
    case "local-lima":
      return "Make sure Lima VM is running (limactl start bands-executor).";
    case "cloudflare":
      return "Make sure you have configured Cloudflare credentials.";
    default:
      return "";
  }
}
