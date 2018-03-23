export { QuerySubscription } from './types';
export { default as QuerySubscriptionHandler } from './handler';

export const subscriptionGraphQLTypes = () => `
    scalar ScalarResourceFilterValue

    enum ScalarResourceFilterOperator {
        eq, ne
        gt, gte
        lt, lte
        in, nin
        regex
    }

    input ScalarResourceFilter {
        operator: ScalarResourceFilterOperator!
        value: ScalarResourceFilterValue!
    }
`;