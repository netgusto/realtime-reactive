import { DocumentNode } from 'graphql';

export type QuerySubscription = {
    id: string;
    query: string;
    variables: any;
    digest: Array<SubscribedResource>;
    cbk: SubscriptionCbk;
    ast: DocumentNode;
    updatenum: number;
};

export type SubscriptionCbk = (queryid: string, data: any, updatenum: number) => void;

export type SubscribedResource = {
    resource: string;
    aggregates: any[];
    alias: string;
    filters: any[];
    sort?: {
        prop: string;
        dir: number;
    };
    limit?: number;
    offset?: number;
    track: {
        totalCount?: number;
        count?: number
        first?: any;
        last?: any;
    };
};

export type ResourceQueryResult = {
    totalCount?: number;
    nodes?: Array<any>;
};

export type GraphQLRunner = (query: string, variables: Object) => Promise<any>;