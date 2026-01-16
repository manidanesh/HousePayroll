import Database from 'better-sqlite3';

/**
 * Generic Base Repository
 */
export abstract class BaseRepository<T> {
    constructor(protected db: Database.Database) { }

    protected get now(): string {
        return new Date().toISOString();
    }

    protected run(sql: string, params: any[] = []): Database.RunResult {
        return this.db.prepare(sql).run(...params);
    }

    protected get<R = T>(sql: string, params: any[] = []): R | undefined {
        return this.db.prepare(sql).get(...params) as R | undefined;
    }

    protected all<R = T>(sql: string, params: any[] = []): R[] {
        return this.db.prepare(sql).all(...params) as R[];
    }

    abstract create(data: Partial<T>): T;
    abstract update(id: number, data: Partial<T>): T;
    abstract delete(id: number): void;
    abstract getById(id: number): T | null;
}
