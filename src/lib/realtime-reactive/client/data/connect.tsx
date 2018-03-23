import * as React from 'react';
import isPromise from 'is-promise';
import { Observable } from 'rxjs';

export type MapQueryToPropsFunc = (props: any, context: any, variables: any) => Promise<Observable<any>>;

export interface ConnectParams {
    observeQuery: MapQueryToPropsFunc;
    requiredContext?: object;
    mapPropsToVariables?: (props: any) => any;
}

export default function connect({ observeQuery, requiredContext, mapPropsToVariables }: ConnectParams) {
    return (WrappedComponent: any) => {

        return class extends React.Component<any, any> {

            static contextTypes = requiredContext;

            public state: {
                unsubscribe?: Function;
                stopObserving?: Function;
                propsbuffer: any;
                variables: any;
            };

            constructor(props: any, context: any) {
                super(props, context);
                this.state = {
                    propsbuffer: null,
                    variables: {},
                };
            }

            componentWillReceiveProps(nextProps: any) {
                if (mapPropsToVariables) {
                    const variables = mapPropsToVariables(nextProps);
                    if (JSON.stringify(variables) !== JSON.stringify(this.state.variables)) {
                        if (this.state.stopObserving) { this.state.stopObserving(); }
                        this.observe(nextProps, variables);
                        this.setState({ variables });
                    }
                }
            }

            componentWillMount() {
                const variables = mapPropsToVariables ? mapPropsToVariables(this.props) : {};
                this.setState({ variables });
                this.observe(this.props, variables);
            }

            componentWillUnmount() {
                if (this.state.unsubscribe) { this.state.unsubscribe(); }
                if (this.state.stopObserving) { this.state.stopObserving(); }
            }

            render() {

                const { propsbuffer } = this.state;

                if (!propsbuffer) {
                    return null;
                }

                return (
                    <WrappedComponent
                        {...propsbuffer}
                        {...this.props}
                    />
                );
            }

            public observe(props: any, variables: any) {

                const { context } = this;
                const stopObserving = new Promise((resolve, reject) => {
                    this.setState({ stopObserving: resolve });
                })/*.then(() => console.log('UNMOUNTED!!!'))*/;

                observeQuery(props, context, variables)
                .then((observable: Observable<any>) => {
                    const subscription = observable
                        .takeUntil(Observable.fromPromise(stopObserving))
                        .subscribe((_props: any) => {

                            if (isPromise(_props)) {
                                _props.then((resolvedprops: any) => this.setState({ propsbuffer: resolvedprops }));
                            } else {
                                const previousprops = this.state.propsbuffer;

                                if (previousprops) {
                                    const mergedResults = { ..._props };
                                    for (const key in previousprops) {
                                        if (previousprops.hasOwnProperty(key)) {
                                            const newVal = mergedResults[key];
                                            if (newVal === undefined) {
                                                mergedResults[key] = previousprops[key];
                                            }
                                        }
                                    }

                                    this.setState({ propsbuffer: mergedResults });
                                } else {
                                    this.setState({ propsbuffer: _props });
                                }
                            }
                        });
                    
                    this.setState({ unsubscribe: subscription.unsubscribe });
                });
            }
        };
    };
}
