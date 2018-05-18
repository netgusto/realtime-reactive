// import isPromise from 'is-promise';
import isObservable from './isObservable';

import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/scan';
import 'rxjs/add/observable/fromPromise';

export interface Action { type: string; payload?: any; }
export type ActionThunk = ((dispatch: Dispatch, state?: any) => any);
export type Dispatch = (action: EventuallyAction|Array<EventuallyAction>) => any;

export type EventuallyAction = Action | ActionThunk | Observable<Action>;

export function makeStore<T>(initialState: T, reducers: object): {
    state$: BehaviorSubject<T>,
    dispatch: Dispatch,
} {

    const applyReducers = (state: T, actions: Action|Array<Action>): T => {

        if (!Array.isArray(actions)) {
            actions = [actions];
        }

        for (const k in actions) {
            if (!actions.hasOwnProperty(k)) { continue; }
            const action = actions[k];
            if (!(action.type in reducers)) {
                continue;
            }

            state = reducers[action.type](state, action);
        }

        return state;
    };

    // state$ is the ApplicationState stream
    //      that collects the valid states once folded by the action stream
    const state$ = new BehaviorSubject<T>(initialState);
    // state$.subscribe((state: T) => console.log('New STATE', state));

    // action$ is the (synchronous or async) action stream
    const action$ = new BehaviorSubject<Array<EventuallyAction>>(initialState as any);   // any cast required to set
    // folded state on action stream

    // Folding the action stream into the ApplicationState stream
    // Inspired by: http://rudiyardley.com/redux-single-line-of-code-rxjs/
    action$
        .concatMap(ensureObservableAndCatchErrors)
        .filter(filterErrors)
        // .do(action => console.log('ACTION DISPATCHED', action))
        .scan(applyReducers)
        .catch(() => Observable.empty())
        .subscribe(state$);

    // Higher order function to send actions to the stream
    const dispatch = (actions: EventuallyAction|Array<EventuallyAction>): any => {

        if (!Array.isArray(actions)) {
            actions = [actions];
        }

        const observableActions = [];

        for (const action of actions) {
            if (isObservable(action)) {
                observableActions.push(action as Observable<Action>);
                // action$.next();
            } else if (typeof action === 'function') { // ActionThunk
                action(dispatch, state$.getValue());
            } else {
                observableActions.push(action as Action);
            }
        }

        action$.next(observableActions);
    };

    return { state$, dispatch };
}

// -------------------------------------
// Stream filtering funcs

function filterErrors(v: any) {
    if (!v) { return false; }

    if (v instanceof Error) {
        console.error(v);
        return false;
    }

    return true;
}

function ensureObservableAndCatchErrors(action: any) {

    let observable: any = null;

    if (isObservable(action)) {
        observable = action;
    } else {
        observable = Observable.of(action);
    }

    observable = observable.catch((err: any) => {

        if (!(err instanceof Error)) {
            err = new Error(err);
        }

        return Observable.of(err);
    });

    return observable;
}
