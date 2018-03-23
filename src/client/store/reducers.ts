import { Action } from '../../lib/realtime-reactive/client/state/store';

import { ApplicationState } from './applicationstate';

export const makeReducers = () => ({
    selectDoc: (state: ApplicationState, action: Action) => ({
        ...state,
        selectedDoc: action.payload
    }),
    sortList: (state: ApplicationState, action: Action) => ({
        ...state,
        sort: action.payload
    }),
    browsePage: (state: ApplicationState, action: Action) => ({
        ...state,
        page: action.payload
    }),
    filterRank: (state: ApplicationState, action: Action) => ({
        ...state,
        page: 1,
        rank: action.payload
    }),
    toggleConnected: (state: ApplicationState, action: Action) => ({
        ...state,
        connected: !state.connected,
    }),
    log: (state: ApplicationState, action: Action) => {
        const log = state.log;
        log.unshift({
            key: state.log.length,
            msg: log.length + ' — ' + action.payload,
        });
        return {
            ...state,
            log,
        };
    },
});