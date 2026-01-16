/**
 * Dependency Injection Container Interface
 */
export interface Container {
    resolve<T>(key: string): T;
    register<T>(key: string, instance: T): void;
}

/**
 * Simple singleton DI container implementation
 */
export class DIContainer implements Container {
    private static instance: DIContainer;
    private services: Map<string, any> = new Map();

    private constructor() { }

    static getInstance(): DIContainer {
        if (!DIContainer.instance) {
            DIContainer.instance = new DIContainer();
        }
        return DIContainer.instance;
    }

    register<T>(key: string, instance: T): void {
        this.services.set(key, instance);
    }

    resolve<T>(key: string): T {
        const service = this.services.get(key);
        if (!service) {
            throw new Error(`Service not found: ${key}`);
        }
        return service;
    }
}

export const container = DIContainer.getInstance();
