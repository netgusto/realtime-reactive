import { Action } from 'realtime-reactive/lib/client/state/store';

export const selectDoc = (msgid: Number): Action => ({
    type: 'selectDoc',
    payload: msgid,
});

export const sortList = (sort: string): Action => ({
    type: 'sortList',
    payload: sort,
});

export const filterRank = (rank: string): Action => ({
    type: 'filterRank',
    payload: rank,
});

export const browsePage = (page: Number): Action => ({
    type: 'browsePage',
    payload: page,
});

export const toggleConnected = (): Action => ({
    type: 'toggleConnected',
    payload: null,
});

export const log = (msg: string): Action => ({
    type: 'log',
    payload: msg,
});
