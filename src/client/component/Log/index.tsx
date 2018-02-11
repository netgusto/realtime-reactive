import * as React from 'react';

export interface Props {
    log: Array<{ key: string, msg: any }>;
}

import './style.css';

export default function (props: Props) {

    const { log } = props;

    return (
        <div>
            <h3>Log</h3>
            <div className="component-log">
                {log.map(logitem => <p key={logitem.key}>{logitem.msg}</p>)}
            </div>
        </div>
    );
}
