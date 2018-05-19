import { DocumentNode } from 'graphql';

export type QuerySubscription = {
    id: string;
    query: string;
    variables: any;
    resources: Array<SubscribedResource>;
    onChange: SubscriptionCbk;
    ast: DocumentNode;
    updatenum: number;
};

export type SubscriptionCbk = (subscriptionid: string, data: any, updatenum: number) => void;

export type SubscribedResource = {
    name: string;
    aggregates: any[];
    alias: string;
    filters: Array<Filter>;
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

export type Filter = {
    name: string,
    getter: (variables: any) => any,
};

export type GraphQLRunner = (query: string, variables: Object) => Promise<any>;