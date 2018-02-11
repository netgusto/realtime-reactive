import { MockWS } from './mock/mockws';

import startServer from './server';
import startClient from './client';

export default function demo() {
    const serverWs = new MockWS('server');

    const clientAWs = new MockWS('clientA', { latency: 800, jitter: 600 });
    const clientBWs = new MockWS('clientB', { latency: 0, jitter: 0 });

    clientAWs.connect(serverWs);
    clientBWs.connect(serverWs);

    startServer(serverWs, function (msg: string) {
        const el = document.getElementById('serverlog') as HTMLElement;
        const node = document.createElement('p');
        node.innerHTML = (el.children.length + 1) + ' &mdash; ' + msg;
        el.insertBefore(node, el.children[0]);
    });

    startClient('Client A: Slow+Jitty', clientAWs, document.getElementById('clientA') as HTMLElement);
    startClient('Client B: Instant', clientBWs, document.getElementById('clientB') as HTMLElement);
}

demo();
