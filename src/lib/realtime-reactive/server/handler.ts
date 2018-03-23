import { print, validate, GraphQLSchema, DocumentNode } from 'graphql';
import gql from 'graphql-tag';

import pruneGQLQuery from './manipulateast';
import { QuerySubscription, ResourceQueryResult, SubscriptionCbk, GraphQLRunner } from './types';
import normalizeQuerySubscription from './normalize';

export default class QuerySubscriptionHandler {

    protected subscriptions: Array<QuerySubscription>;
    protected graphQLRunner: GraphQLRunner;
    protected schema: GraphQLSchema;
    protected nextsubid: number = 0;

    public constructor({ graphQLRunner, schema }:
        {
            graphQLRunner: GraphQLRunner,
            schema: GraphQLSchema,
        }) {

        this.subscriptions = [];

        this.graphQLRunner = graphQLRunner;
        this.schema = schema;
    }

    public register(
        query: string,
        variables: any,
        cbk: SubscriptionCbk
    ): { subscription?: QuerySubscription, errors?: any } {

        let ast: DocumentNode;

        try {
            ast = gql(query);
        } catch (e) {
            return { errors: [e] };
        }

        const requestErrors = validate(this.schema, ast);
        if (requestErrors.length > 0) {
            return { errors: requestErrors.map(gqlerror => gqlerror.message) };
        }

        const { queries: digest, err } = normalizeQuerySubscription(
            ast,
            variables
        );
        if (err !== null) {
            return { errors: [err] };
        }

        const subscription: QuerySubscription = {
            id: (this.nextsubid++).toString(),
            query,
            variables,
            digest,
            ast,
            cbk,
            updatenum: 0,
        };

        this.registerSubscription(subscription);

        return { subscription, errors: null };
    }

    public unregister(subscriptionId: string): boolean {
        const lengthBefore = this.subscriptions.length;
        this.subscriptions = this.subscriptions.filter(sub => sub.id !== subscriptionId);
        return this.subscriptions.length < lengthBefore;
    }

    public onChange(collectionName: string, operation: string, _data: Array<any> | any) {

        let changeddata = Array.isArray(_data) ? _data : [_data];
        const doc = changeddata[0];

        for (const subIndex in this.subscriptions) {
            if (!this.subscriptions.hasOwnProperty(subIndex)) { continue; }

            const sub = this.subscriptions[subIndex];

            const recomputes = [];
            const keepProps = {};
            const removeResources = [];

            for (const resourceDigest of sub.digest) {

                if (resourceDigest.resource !== collectionName) {
                    removeResources.push(resourceDigest.alias);
                    continue;
                }

                const hasNeverBeenTracked = !resourceDigest.track.first || !resourceDigest.track.last;
                const hasAggregation = Object.keys(resourceDigest.aggregates).length > 0;

                if (hasNeverBeenTracked) {
                    recomputes.push({
                        ressource: resourceDigest.alias,
                        onlyAggregations: false,
                    });
                } else {
                    switch (operation) {
                        case 'insert': {
                            if (!this.passesFilters(resourceDigest, sub.variables, doc)) {
                                removeResources.push(resourceDigest.alias);
                                continue;
                            }

                            if (this.isBeforeOrWithinRange(resourceDigest, doc)) {
                                recomputes.push({
                                    ressource: resourceDigest.alias,
                                    onlyAggregations: false,
                                });
                            } else if (hasAggregation) {
                                recomputes.push({
                                    ressource: resourceDigest.alias,
                                    onlyAggregations: true,
                                });
                            } else {
                                removeResources.push(resourceDigest.alias);
                            }

                            break;
                        }
                        default: { /**/ }
                    }
                }
            }

            if (recomputes.length > 0) {

                for (const recomputation of recomputes) {
                    if (recomputation.onlyAggregations) {
                        keepProps[recomputation.ressource] = ['totalCount'];
                    }
                }

                let query = sub.query;

                if (Object.keys(keepProps).length > 0 || removeResources.length > 0) {
                    const prunedAST = pruneGQLQuery(sub.ast, { keepProps, removeResources });
                    query = print(prunedAST);
                }

                const updatenum = sub.updatenum++;
                const subIndexNew = JSON.parse(JSON.stringify(subIndex));

                // TODO: here, somehow cancel previous promises when new one is executed
                // There might be some race condition on the resource "track"
                // if the GQL server anwser one query later than the following for the same resource

                this.graphQLRunner(query, sub.variables)
                    .then(response => response.data)
                    .then(data => {

                        const subNew = this.subscriptions[subIndexNew];

                        for (const digestIndex in subNew.digest) {
                            if (!subNew.digest.hasOwnProperty(digestIndex)) {
                                continue;
                            }

                            const resourceDigest = subNew.digest[digestIndex];
                            const resourceAlias = resourceDigest.alias;

                            if (!(resourceAlias in data)) {
                                // resource has been pruned from graphql query
                                continue;
                            }

                            // track first and last in range for this resource
                            const resourceData = data[resourceAlias] as ResourceQueryResult;

                            // TODO: use alias rather than prop name here
                            resourceDigest.track.totalCount =
                                ('totalCount' in resourceData) ? resourceData.totalCount : undefined;

                            const track = resourceDigest.track;

                            if (resourceData.nodes) {
                                const nodesLength = resourceData.nodes.length;
                                track.count = nodesLength;
                                track.first = nodesLength > 0 ? resourceData.nodes[0] : false;
                                track.last = nodesLength > 0 ? resourceData.nodes[nodesLength - 1] : false;
                            }
                        }

                        return data;
                    })
                    .then(data => sub.cbk(sub.id, data, updatenum));
            }
        }
    }

    protected doesMatch(filterOperator: string, filterValue: any, consideredValue: any): boolean {

        // eq, ne
        // gt, gte
        // lt, lte
        // in, nin
        // regex

        switch (filterOperator) {
            case 'eq': return consideredValue === filterValue;
            case 'ne': return consideredValue !== filterValue;
            case 'gt': return consideredValue > filterValue;
            case 'gte': return consideredValue >= filterValue;
            case 'lt': return consideredValue < filterValue;
            case 'lte': return consideredValue <= filterValue;
            case 'in': return Array.isArray(filterValue) && filterValue.indexOf(consideredValue) > -1;
            case 'nin': return !Array.isArray(filterValue) || filterValue.indexOf(consideredValue) === -1;
            case 'regex': return !!consideredValue.match(new RegExp(filterValue));
            default: { /**/ }
        }

        return false;
    }

    protected isBeforeOrWithinRange(digest: any, doc: any): boolean {

        const { sort, track } = digest;
        if (!sort) { return true; }

        const sortValueFirst = track.first[sort.prop];
        const sortValueLast = track.last[sort.prop];
        const docValue = doc[sort.prop];

        const lowerValue = sortValueFirst < sortValueLast ? sortValueFirst : sortValueLast;
        const higherValue = sortValueFirst >= sortValueLast ? sortValueFirst : sortValueLast;

        return (sort.dir > 0) ? docValue <= higherValue : docValue >= lowerValue;
    }

    protected passesFilters(digest: any, variables: any, doc: any): boolean {
        for (const filter of digest.filters) {
            const filterSpec = filter.getter(variables);
            if (!filterSpec) { return true; }   // variable not defined for filter

            if (!this.doesMatch(filterSpec.operator, filterSpec.value, doc[filter.name])) {
                return false;
            }
        }

        return true;
    }

    protected registerSubscription(subscription: QuerySubscription): QuerySubscriptionHandler {
        this.subscriptions.push(subscription);

        // send initial payload
        this.graphQLRunner(subscription.query, subscription.variables)
            .then(response => subscription.cbk(subscription.id, response.data, subscription.updatenum++));

        return this;
    }

    /*
        => subscribe to doc
            => where
            => sort
            => [offset, offset+limit]

        ==> Si add
            ==> apply where, in code
                ==> si true et aggrégation (count) => rebuild aggrégation + trigger
                ==> si true, sort prop >= first && <= last value of query (kept in cache)
                    => si true, query
                        => si dedans => trigger results

        ==> Si del
            ==> where: ==> si true et aggrégation (count) => rebuild aggrégation + trigger
            ==> si where + in range => trigger

        ==> Si update
            ==> si modification dans propriétés filtrées et aggrégation => rebuild aggrégation + trigger
            ==> si modification dans propriétés sélectionnées ou filtrées
                ==> doc avant
                    ==> where + range + query; si dans query => trigger
                    ==> sinon doc après:
                        => where + range + query; si dans query => trigger

    */
}