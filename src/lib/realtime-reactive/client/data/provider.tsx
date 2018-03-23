import * as React from 'react';
import * as PropTypes from 'prop-types';
import invariant from 'invariant';

export interface Props {
    subscribeQuery: (...args: any[]) => Promise<any>;
    children: JSX.Element|JSX.Element[];
}

export default class DataProvider extends React.Component<Props, any> {

    static childContextTypes = {
        subscribeQuery: PropTypes.func.isRequired,
    };

    constructor(props: Props, context: any) {
        super(props, context);

        invariant(
            props.subscribeQuery,
            'StateProvider was not passed a subscribeQuery() function. Make ' +
            'sure you pass in your subscribeQuery() function via the "subscribeQuery" prop.',
        );
    }

    getChildContext() {
        return {
            subscribeQuery: this.props.subscribeQuery,
        };
    }

    render() {
        return this.props.children;
    }
}
