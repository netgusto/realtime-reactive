import * as faker from 'faker';

export type listenerCbk = (data: any, from: MockWS, requestid?: string) => void;
export type unsubscribeCbk = () => void;

export class MockWS {

    private subscribers: Map<string, Map<number, listenerCbk>>;
    private nextid: number = 1;
    private otherends: Array<MockWS>;
    private latency?: number;
    private jitter?: number;
    private pendingRequests: Map<string, any>;
    private name: string;

    constructor(name: string, { latency, jitter }: { latency?: number, jitter?: number } = {}) {
        this.name = name;
        this.subscribers = new Map<string, Map<number, listenerCbk>>();
        this.otherends = [];
        this.latency = latency;
        this.jitter = jitter;
        this.pendingRequests = new Map();
    }

    public setLatency(latency?: number): MockWS {
        this.latency = latency;
        return this;
    }

    public getLatency(): number|undefined {
        return this.latency;
    }

    public setJitter(jitter?: number): MockWS {
        this.jitter = jitter;
        return this;
    }

    public getJitter(): number|undefined {
        return this.jitter;
    }

    public request(topic: string, data: object): Promise<void> {

        if (this.otherends.length !== 1) {
            throw new Error('On WS(' + this.name + '):'
                + ' Cannot request if WS endpoint is server side (connected to multiple other endpoints)');
        }

        const server = this.otherends[0];

        const reqid = faker.random.uuid();

        const p = new Promise<void>((resolve, reject) => {
            this.pendingRequests.set(reqid, {
                resolve,
                reject,
            });

            this.send(server, topic, data, reqid)
                .catch(reject);
        });

        return p;
    }

    public respond(otherend: MockWS, requestid: string, payload: object): Promise<void> {
        return this.send(otherend, '', payload, requestid);
    }

    public receive(sender: MockWS, serializedData: string) {
        const unserializedData = JSON.parse(serializedData);

        // open envelope
        const payload = 'payload' in unserializedData ? unserializedData.payload : null;
        const reqid = ('_requestid' in unserializedData) ? unserializedData._requestid : null;
        const topic = ('topic' in unserializedData) ? unserializedData.topic : null;

        if (reqid) {
            delete unserializedData._requestid;

            if (this.pendingRequests.has(reqid)) {
                this.pendingRequests.get(reqid).resolve(payload);
                return;
            }
        }

        if (topic && this.subscribers.has(topic)) {
            (this.subscribers.get(topic) as Map<number, listenerCbk>)
                .forEach(subscriber => subscriber(payload, sender, reqid));
        }
    }

    public subscribe(topic: string, listener: listenerCbk): unsubscribeCbk {
        const id = this.nextid;
        this.nextid++;
    
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Map<number, listenerCbk>());
        }

        const subscribersForTopic = this.subscribers.get(topic) as Map<number, listenerCbk>;

        subscribersForTopic.set(id, listener);

        let called = false;

        return () => {
            if (called) { return; }
            (this.subscribers.get(topic) as Map<number, listenerCbk>).delete(id);
            called = true;
        };
    }

    public send(otherend: MockWS, topic: string, payload: object, requestid?: string): Promise<void> {

        const envelope = {
            payload,
            topic,
        };

        if (requestid) {
            (envelope as any)._requestid = requestid;
        }

        const serializedData = JSON.stringify(envelope);

        return new Promise((resolve, reject) => {

            // Resolving delay from end to end on this line
            const jitterDirection = (Math.random() > .5 ? 1 : -1);

            const senderJitter = this.getJitter() || 0;
            const receiverJitter = otherend.getJitter() || 0;
            const lineJitter = Math.max(senderJitter / 2, receiverJitter / 2);  // /2 because half is +dir, half is -dir
            const actualJitter = Math.random() * lineJitter * jitterDirection;

            const senderLatency = this.getLatency() || 0;
            const receiverLatency = otherend.getLatency() || 0;
            const lineLatency = Math.max(senderLatency, receiverLatency);

            let delay = lineLatency + actualJitter;
            if (delay < 0) { delay = 0; }

            setTimeout(
                () => {
                    // console.log(serializedData);
                    otherend.receive(this, serializedData);
                    resolve();
                },
                delay
            );
        });
    }

    public connect(otherend: MockWS) {
        this.otherends.push(otherend);
        otherend.acceptConnection(this);
    }

    // no reciprocal connect to avoid infinite recursion!
    private acceptConnection(otherend: MockWS) {
        this.otherends.push(otherend);
    }
}
