import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Subject, Observable } from 'rxjs';

import { makeStore } from '../lib/realtime-reactive/client/state/store';
import StateProvider from '../lib/realtime-reactive/client/state/provider';
import DataProvider from '../lib/realtime-reactive/client/data/provider';

import { MockWS } from '../mock/mockws';
import { ApplicationState } from './store/applicationstate';
import { makeReducers } from './store/reducers';

import App from './container/App'; 
import Log from './container/Log';

export default function startClient(name: string, ws: MockWS, container: HTMLElement) {

    const initialState: ApplicationState = {
        connected: true,
        selectedDoc: null,
        sort: '-rank',
        page: 1,
        rank: 'bottom',
        log: [],
    };

    const { state$, dispatch } = makeStore<ApplicationState>(
        initialState,
        makeReducers(),
    );

    const subscribeQuery = (args: { query: string, variables?: any }): Promise<Observable<any>> => {

        return ws.request('observequery', args)
            .then((subscription: any) => {

                if (subscription.errors) {
                    throw new Error(subscription.errors);
                }

                const stream$ = new Subject<any>();
                const unsubscribeUpdates = ws.subscribe('queryupdate:' + subscription.id, (update: any) => {
                    stream$.next(update);
                });

                let currentUpdateNum = -1;

                return stream$

                    // protecting against old updates arriving late on jitty lines
                    .filter((update: any) => update.updatenum > currentUpdateNum)
                    .do((update: any) => currentUpdateNum = update.updatenum)

                    // unobserve query on server when observable closed or unsubscribed
                    .finally(() => {
                        unsubscribeUpdates();
                        ws.request('unobservequery', subscription.id);
                    });
            });
    };

    const observeState = state$.subscribe.bind(state$);
    const getCurrentState = state$.getValue.bind(state$);

    ReactDOM.render(
        <StateProvider observeState={observeState} getCurrentState={getCurrentState} dispatch={dispatch}>
            <DataProvider subscribeQuery={subscribeQuery}>
                <App name={name} />
                <hr />
                <Log />
            </DataProvider>
        </StateProvider>,
        container,
    );
}