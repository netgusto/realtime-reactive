import { QuerySubscription, QuerySubscriptionHandler } from 'realtime-reactive/lib/server';

import { MockWS } from '../mock/mockws';
import graphqlServer, { schema } from './gqlserver';
import { connectMockDB, generateRandomDoc } from './db';

export default function startServer(ws: MockWS, log: (msg: string) => void) {

    const mockDb = connectMockDB();
    const mockGQLServer = graphqlServer(mockDb);

    // Mock: Regularily pushing fake updates to clients
    setInterval(
        () => {
            mockDb.getCollection('docs').insert(generateRandomDoc());
        },
        1000 / 3
    );

    const querySubscriptionHandler = new QuerySubscriptionHandler({
        graphQLRunner: mockGQLServer,
        schema,
        collections: {
            docs: mockDb.getCollection('docs')
        }
    });

    // Realtime reactive GraphQL query subscription
    ws.subscribe('observequery', ({ query, variables }: { query: string, variables: any }, from, requestid) => {

        const { subscription, errors } = querySubscriptionHandler.register(
            query,
            variables,
            (queryid: string, data: any, updatenum: number) => {
                ws.send(from, 'queryupdate:' + queryid, {
                    queryid,
                    data,
                    updatenum,
                });
            }
        );

        if (!requestid) { return; }
        if (errors) {
            ws.respond(from, requestid, { errors });
            return;
        }

        const okSubscription = subscription as QuerySubscription;

        log('observing query ' + JSON.stringify({ subid: okSubscription.id, success: true }));
        ws.respond(from, requestid, { id: okSubscription.id });
    });

    // Realtime reactive GraphQL query unsubscription
    ws.subscribe('unobservequery', (subid: string, from, requestid) => {
        const success = querySubscriptionHandler.unregister(subid);
        
        if (!requestid) { return; }

        log('unobserving query ' + JSON.stringify({ subid, success }));

        ws.respond(from, requestid, { id: subid, success });
    });

}
