# realtime-reactive

```bash
$ yarn install
$ yarn start
# then open http://localhost:3000
```

This little experiment simulates 2 clients and 1 server connected by Websockets, where clients subscribe to GraphQL queries on the server. The server, both clients and the websocket connexions are all simulated on the JS environment of your browser.

Any data change on the server (spontaneous, or emanating from a client) is reactively pushed to the relevant clients with as little data transmitted on the wire as possible.

This is made possible by:

1. subscriptions by the server to the database on low level CRUD events
2. making GraphQL queries transparent to the static analisys of the nature of their parameters
3. an algorithm (the core of the experiment) that's able to determine (thanks to 1. and 2.) whether or not a change in data requires the recomputation of any query / aggregation

![](https://user-images.githubusercontent.com/4974818/40438503-877d1530-5eb8-11e8-94c3-d5c5e9a9261a.jpg)
