- how do i prevent new connections?
- how to tell if a peer supports my protocol? (just attempt dial?)

- clients are both dialing kitsunet at eachother
- how will we ever get wrtc stable?

- stream each peer's networkState to cnc


- [ ] network research
  - [ ] what to measure to determine network health?
  - [ ] what infrastructure to point at (instead of ipfs defaults)
  - [ ] how to stand up `ws-star.cloud.ipfs.team`
  - [ ] how do we limit peers to avoid crashing

- [ ] metamask light client
  - [ ] block sync
  - [ ] how to setup custom protocol/rpc over libp2p
  - [ ] pubsub with validation
  - [ ] how to shard data
  - [ ] how to process new txs to get new state

  - what telemetry is useful to gather
    - bandwidth
    - location
    - memory available?
    - connects/disconnects/discoveries
    - pubsub spanning tree
    - errors: sentry
  - @vyzo is working on pubsub
  - @JGAntunes is working on pubsub
    - https://github.com/ipfs/notes/issues/266
  - platform deploy a "job" (eg peering strategy)
  - how to stand up `ws-star.cloud.ipfs.team`?
    - https://github.com/libp2p/js-libp2p-websocket-star-rendezvous
  - how do we limit peers to avoid crashing?
    - @pgte is working on this
    - application level prioritization of peers
    - https://github.com/ipfs/dynamic-data-and-capabilities/issues/3#issuecomment-361919002
    - watch repo https://github.com/libp2p/js-libp2p-connection-manager
  - how to configure the ipfs node for this experiment?
    - just boot libp2p?

  ### eth light client
  - GraphSync + selectors
  - implement custom protcols
    - [dialProtocol](https://github.com/libp2p/js-libp2p#libp2pdialprotocolpeer-protocol-callback)
    - [handleProtocol](https://github.com/libp2p/js-libp2p#libp2phandleprotocol-handlerfunc--matchfunc)
    - [example protocol - check dialer and listener inside src](https://github.com/libp2p/js-libp2p-identify/)




    bridge (golang)
      + peer index
      + block syncer
      + state bridge
      + go-ipfs
          ipld selector alpha (handling) <--- daviddias
      - state prefetch
      - state transition (full)

    metamask (js) <--- daviddias
      + block tracking via ipns published head
      + ipld selector alpha (requesting)
      + broadcast new tx
      - log querying ????????
      - peering: bridge
      - block syncing

    light client perf hacks
      - eth_call proofs (eth_call as query)
      - pub/sub storage/logs on full node
      - extra-consensus geth bloom filter trie


    Better eth rpc
      - stream data (e.g. logs), with cancel (+ backpressure?)
      - selectors
      - query trace (anything sent message/eth to me)




    perf: ipld-resolver selector alpha
    peering: 1) bridge 2) metamask mesh
    new block + tx publishing
    coselector indexing
     tx -> block
     log querying, log -> tx
