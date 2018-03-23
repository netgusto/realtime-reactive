import isPromise from 'is-promise';
import isObservable from './isObservable';

import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/scan';

export interface Action { type: string; payload?: any; }
export type AsyncAction = ((dispatch: Dispatch, state?: any) => Action);
export type ActionThunk = ((dispatch: Dispatch, state?: any) => any);
export type Dispatch = (action: EventuallyAction) => any;

export type EventuallyAction = Action | AsyncAction | ActionThunk | Observable<Action> | Promise<Action>;

export function makeStore<T>(initialState: T, reducers: object): {
    state$: BehaviorSubject<T>,
    dispatch: Dispatch,
} {

    const applyReducers = (state: T, action: Action): T => {

        if (!(action.type in reducers)) {
            return state;
        }

        return reducers[action.type](state, action);
    };

    // state$ is the ApplicationState stream
    //      that collects the valid states once folded by the action stream
    const state$ = new BehaviorSubject<T>(initialState);
    // state$.subscribe((state: T) => console.log('New STATE', state));

    // action$ is the (synchronous or async) action stream
    const action$ = new BehaviorSubject<EventuallyAction>(initialState as any);   // any cast required to set
    // folded state on action stream

    // Folding the action stream into the ApplicationState stream
    // Inspired by: http://rudiyardley.com/redux-single-line-of-code-rxjs/
    action$
        .mergeMap(ensureObservableAndCatchErrors)
        .filter(filterErrors)
        // .do(action => console.log('ACTION DISPATCHED', action))
        .scan(applyReducers)
        .catch(() => Observable.empty())
        .subscribe(state$);

    // Higher order function to send actions to the stream
    const dispatch = (action: EventuallyAction): any => {

        if (isObservable(action)) {
            action$.next(action as Observable<Action>);
        } else if (isPromise(action)) {
            action$.next((Observable.fromPromise(action as Promise<Action>)));
        } else if (typeof action === 'function') { // ActionThunk
            return action(dispatch, state$.getValue());
        } else {
            action$.next(action);
        }

        return action;
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
