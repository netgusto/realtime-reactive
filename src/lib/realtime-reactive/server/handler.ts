import { print, validate, GraphQLSchema, DocumentNode } from 'graphql';
import gql from 'graphql-tag';

import pruneGQLQuery from './manipulateast';
import { QuerySubscription, ResourceQueryResult, SubscriptionCbk, GraphQLRunner, SubscribedResource } from './types';
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

    // Registers a GQL query with variables values for change tracking
    public register(
        query: string,
        variables: any,
        onChange: SubscriptionCbk
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

        const { queries, err } = normalizeQuerySubscription(
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
            resources: queries,
            ast,
            onChange,
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

    public onChange(resourceName: string, operation: string, _data: Array<any> | any) {

        // Normalizing incoming event; for now, one doc per event is expected
        let changeddata = Array.isArray(_data) ? _data : [_data];
        const doc = changeddata[0];

        this.subscriptions.map(subscription => this.notifySubscriptionAboutDocOperationIfConcerned(
            subscription,
            doc,
            resourceName,
            operation
        ));
    }

    protected notifySubscriptionAboutDocOperationIfConcerned(
        subscription: QuerySubscription,
        doc: any,
        collectionName: string,
        operation: string
    ) {

        // Determine necessary computations for each resource involved in the subscription
        const operations = subscription.resources.map(resource =>
            this.determineNecessaryComputationsForSubscription(doc, resource, collectionName, operation, subscription)
        );

        // Merge all resource computations to consider the query as a whole
        const { recomputes, removeResources } = operations.reduce(
            (carry, value) => {
                return {
                    recomputes: [...carry.recomputes, ...value.recomputes],
                    removeResources: [...carry.removeResources, ...value.removeResources],
                };
            },
            {
                recomputes: [],
                removeResources: []
            }
        );

        if (!recomputes.length) { return; }

        const keepOnlyTheseProps = {};

        for (const recomputation of recomputes) {
            if (recomputation.aggregationsOnly) {
                keepOnlyTheseProps[recomputation.ressource] = ['totalCount'];
            }
        }

        let query = subscription.query;

        if (Object.keys(keepOnlyTheseProps).length > 0 || removeResources.length > 0) {
            const prunedAST = pruneGQLQuery(subscription.ast, { keepOnlyTheseProps, removeResources });
            query = print(prunedAST);
        }

        const updatenum = subscription.updatenum++;

        // TODO: here, somehow cancel previous promises when new one is executed
        // There might be some race condition on the resource tracking
        // if the GQL server answers later for a previous query later for the same resource

        this.graphQLRunner(query, subscription.variables)
            .then(response => response.data)
            .then(data => { this.trackClientDataForSubscription(subscription, data); return data; })
            .then(data => subscription.onChange(subscription.id, data, updatenum));
    }

    protected determineNecessaryComputationsForSubscription(
        doc: any,
        resourceDigest: SubscribedResource,
        collectionName: string,
        operation: string,
        sub: QuerySubscription
    ) {

        const computations: {
            recomputes: Array<{
                ressource: string,
                aggregationsOnly: boolean,
            }>,
            removeResources: Array<string>
        } = { recomputes: [], removeResources: [] };

        if (resourceDigest.name !== collectionName) {
            computations.removeResources.push(resourceDigest.alias);
            return computations;
        }

        const hasNeverBeenTracked = !resourceDigest.track.first || !resourceDigest.track.last;
        const hasAggregation = Object.keys(resourceDigest.aggregates).length > 0;

        if (hasNeverBeenTracked) {
            computations.recomputes.push({
                ressource: resourceDigest.alias,
                aggregationsOnly: false,
            });
        } else {
            switch (operation) {
                case 'insert': {

                    if (!this.docMatchesFilters(doc, resourceDigest.filters, sub.variables)) {
                        // doc is not concerned by query filter; this subscription cannot be impacted
                        computations.removeResources.push(resourceDigest.alias);
                        return computations;
                    }

                    if (this.isBeforeOrWithinRange(resourceDigest, doc)) {
                        computations.recomputes.push({
                            ressource: resourceDigest.alias,
                            aggregationsOnly: false,
                        });
                    } else if (hasAggregation) {
                        computations.recomputes.push({
                            ressource: resourceDigest.alias,
                            aggregationsOnly: true,
                        });
                    } else {
                        computations.removeResources.push(resourceDigest.alias);
                    }

                    break;
                }
                default: { /**/ }
            }
        }

        return computations;
    }

    protected trackClientDataForSubscription(subscription: QuerySubscription, data: any) {
        subscription.resources.map(resource => {

            // track first and last in range for this resource
            const resourceData = data[resource.alias] as ResourceQueryResult;

            // TODO: use alias rather than prop name for totalCount here
            resource.track.totalCount =
                ('totalCount' in resourceData) ? resourceData.totalCount : undefined;

            const track = resource.track;

            if (resourceData.nodes) {
                const nodesLength = resourceData.nodes.length;
                track.count = nodesLength;
                track.first = nodesLength > 0 ? resourceData.nodes[0] : false;
                track.last = nodesLength > 0 ? resourceData.nodes[nodesLength - 1] : false;
            }
        });
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

    protected docMatchesFilters(doc: any, filters: any, variables: any): boolean {
        for (const filter of filters) {

            const filterSpec = filter.getter(variables);
            if (!filterSpec) { return true; }   // variable not defined for filter

            if (!this.valueMatchesCondition(filterSpec.operator, filterSpec.value, doc[filter.name])) {
                return false;
            }
        }

        return true;
    }
    
    protected valueMatchesCondition(filterOperator: string, filterValue: any, consideredValue: any): boolean {

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

    protected registerSubscription(subscription: QuerySubscription): QuerySubscriptionHandler {
        this.subscriptions.push(subscription);

        // send initial payload
        this.graphQLRunner(subscription.query, subscription.variables)
            .then(response => subscription.onChange(subscription.id, response.data, subscription.updatenum++));

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