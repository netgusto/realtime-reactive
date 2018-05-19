import {
    graphql,
    buildSchema,
    ExecutionResult,
    GraphQLSchema,
} from 'graphql';

import { subscriptionGraphQLTypes } from '../lib/realtime-reactive/server';

export const schema: GraphQLSchema = buildSchema(`

    ` + subscriptionGraphQLTypes() + `

    type Query {
        docs(
            sort: String, offset: Int, limit: Int,
            id: ScalarResourceFilter,
            firstname: ScalarResourceFilter,
            lastname: ScalarResourceFilter,
            rank: ScalarResourceFilter,
        ): DocList!
    }

    type Mutation {
        createDoc(doc: DocInput!): Doc
        updateDoc(id: String!, doc: DocInput!): Doc
        deleteDoc(id: String!): Boolean!
    }

    type DocList {
        totalCount: Int!
        nodes: [Doc]!
    }

    type Doc {
        id: String!
        rank: Int!
        firstname: String!
        lastname: String!
        color: String!
    }

    input DocInput {
        rank: Int!
        firstname: String!
        lastname: String!
    }
`);

const resolvers = {
    docs(params: any, { db }: { db: Loki }) {

        const docs = db.getCollection('docs');

        let qb = docs.chain();

        if ('id' in params) {
            qb.find({ id: params.id });
        }

        const find = {};
        const filterprops = Object.keys(params).filter(prop => ['sort', 'offset', 'limit'].indexOf(prop) === -1);
        for (const filterprop of filterprops) {
            const filter = params[filterprop];
            find[filterprop] = { ['$' + filter.operator]: filter.value };
        }

        if (Object.keys(find).length > 0) {
            qb = qb.find(find);
        }

        const qbcount = qb;

        const { sort, offset, limit } = params;

        if (sort) {
            const desc = sort.charAt(0) === '-' ? true : false;
            const col = sort.replace(/^-/, '');
            qb = qb.simplesort(col, desc);
        }

        if (offset) { qb = qb.offset(offset); }
        if (limit) { qb = qb.limit(limit); }

        return {
            totalCount: qbcount.count(),
            nodes: qb.data()
                .map(item => {
                    const obj = Object.assign({}, item);
                    delete obj.meta;
                    delete obj.$loki;
                    return obj;
                }),
        };
    },
    deleteDoc({ id }: { id: string }, { db }: { db: Loki }): boolean {
        const docs = db.getCollection('docs');

        if (Math.random() > 0.9) {
            return false;
        }

        const doc = docs.findOne({ id });
        if (doc) {
            return docs.remove(doc);
        }

        return false;
    },
};

export default (db: Loki) => (query: string, variables?: any): Promise<ExecutionResult> => {
    return graphql(schema, query, resolvers, { db }, variables);
};
