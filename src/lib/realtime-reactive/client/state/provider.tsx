import * as React from 'react';
import * as PropTypes from 'prop-types';
import invariant from 'invariant';

import { Action } from './store';

export interface Props {
    observeState: () => void;
    getCurrentState: () => any;
    dispatch: (action: Action) => void;
    children: JSX.Element | JSX.Element[];
}

export default class StateProvider extends React.Component<Props, any> {

    static childContextTypes = {
        observeState: PropTypes.func.isRequired,
        getCurrentState: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
    };

    constructor(props: Props, context: any) {
        super(props, context);

        invariant(
            props.observeState,
            'StateProvider was not passed a observeState() function. Make ' +
            'sure you pass in your observeState() function via the "observeState" prop.',
        );

        invariant(
            props.getCurrentState,
            'StateProvider was not passed a getCurrentState() function. Make ' +
            'sure you pass in your getCurrentState() function via the "getCurrentState" prop.',
        );

        invariant(
            props.dispatch,
            'StateProvider was not passed an dispatch function. Make ' +
            'sure you pass it in the "dispatch" prop.',
        );
    }

    getChildContext() {
        return {
            observeState: this.props.observeState,
            getCurrentState: this.props.getCurrentState,
            dispatch: this.props.dispatch,
        };
    }

    render() {
        return this.props.children;
    }
}
