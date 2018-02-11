export interface ApplicationState {
    connected: boolean;
    selectedDoc: number | null;
    sort: string;
    page: number;
    rank: string;
    log: Array<any>;
}