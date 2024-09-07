export type QueryParam = Record<string, string | number>;

export interface Connector{
    get<T>(query: string, params?: QueryParam): Promise<T>;
    getAll<T>(query: string, params?: QueryParam): Promise<T[]>;
    execute(query: string, params?: QueryParam): void;
}