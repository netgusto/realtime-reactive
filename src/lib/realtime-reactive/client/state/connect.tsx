import * as React from 'react';
import { Subscription } from 'rxjs';
import * as PropTypes from 'prop-types';

export type MapStateToPropsFunc = (state: any, props: any, dispatch: any, context?: any) => any;

export default function connect(mapStateToProps: MapStateToPropsFunc, requiredContext?: any) {

    return (WrappedComponent: any): any => {

        return class extends React.Component<any, any> {

            static contextTypes = {
                observeState: PropTypes.func.isRequired,
                getCurrentState: PropTypes.func.isRequired,
                dispatch: PropTypes.func.isRequired,
                ...requiredContext,
            };

            public state: {
                subscription?: Subscription;
                propsbuffer?: any;
            };

            constructor(props: any, context: any) {
                super(props, context);
                this.state = {
                    propsbuffer: {},
                };
            }

            componentWillMount() {

                const { context: { observeState, getCurrentState } } = this;

                this.storeHasChanged(getCurrentState());

                this.setState({
                    subscription: observeState({
                        next: (state: any) => this.storeHasChanged(state),
                    })
                });
            }

            componentWillUnmount() {
                if (this.state.subscription) { this.state.subscription.unsubscribe(); }
            }

            render() {

                const { propsbuffer } = this.state;

                return (
                    <WrappedComponent
                        {...this.props}
                        {...propsbuffer}
                    />
                );
            }

            storeHasChanged(state: any) {

                const { dispatch } = this.context;

                let requestedContext: any = undefined;
                if (requiredContext) {
                    requestedContext = {};
                    Object.keys(requiredContext).map(contextKey => {
                        if (contextKey in this.context) {
                            requestedContext[contextKey] = this.context[contextKey];
                        }
                    });
                }

                const props = mapStateToProps(state, this.props, dispatch, requestedContext);

                this.setState({
                    propsbuffer: props,
                });
            }
        };
    };
}
