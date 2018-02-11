import * as React from 'react';
import { pure } from 'recompose';

import ListContainer from '../../container/DocList';

export interface Props {
    name: string;
    connected: boolean;
    toggleConnected: () => void;
}

function App(props: Props) {

    const { connected, toggleConnected } = props;
    
    return (
        <div>
            <h2>
                {props.name} <button onClick={toggleConnected}>
                    {connected ? 'Disconnect' : 'Connect'}
                </button>
            </h2>
            {connected && <ListContainer />}
        </div>
    );
}

export default pure(App);
