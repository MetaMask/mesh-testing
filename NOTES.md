### presentation

- [ ] viz perf
- [ ] color by block syncing
- [ ] add actions for accessing bridge

### kitsunet todo

- [ ] re-enable persistence
- [ ] add actions for accessing bridge
- [ ] update libp2p
- [ ] color by block syncing

### todo

- [ ] perf
    - [ ] layout without many body (e.g. circle)
- [ ] client network opt
    - [ ] reduce granularity of traffic measurements
    - [ ] clients should push state via diffs
- [ ] experiments
    - [ ] topology control / finding peers by topic
        - [ ] control of peers
            - [ ] disconect a specific peer
            - [x] drop all current peers
        - [ ] control of discovery?
            - [x] blocked by upstream PR
    - [ ] block syncing
        - [ ] run ethereumjs-client devp2p
        - [ ] try streaming blocks
    - [ ] group/slice discovery
        - [ ] setup experiment with rarer content
        - [ ] experiment: find a peer for a group we dont have
- [ ] useability
    - [ ] show network traffic totals
    - [ ] move debug / errors to SidePanel
    - [ ] select node by id, input box
    - [ ] some nodes with lots of connections?
        - [ ] list number of peers
        - [ ] color by peer count
    - [ ] traffic graph tooltip bugs out
        - [ ] dont rerender unless data deep changed
- [ ] modularity
    - [ ] figure out kitsunet strategy
    - [ ] SidePanel should be populated by experiments


### potential bugs

- nodes with lots of peers not responding to disconnectAll?
- local nodes becomming unresponsive after long computer sleep?
- lots of nodes not connected to telemetry
- everything erroring always
- do old peers fail silently when we open too many webrtc connections?
- disconnecting all clients seems to result in all clients reconnecting?

### done

- interactive
    - [x] re-enable actions, needs a fix in telemetry
        - [x] redeploy telemetry
        - [x] re-add actions to experiments
- routing table is bogged down by old peers, unuseable
    - [x] enable persistence
    - [x] dont display diconnected nodes
- [x] custom graph
  - experiments export graph builders
    - color
    - topology
    - node size
- [X] merge older todos

### ethereumjs-client / devp2p / syncing

- try streaming blocks (not bound by rpc or block boundries)
- ensure stream of blocks is decoupled from validation
- validate blocks in parallel

### error zoo

```
client-bundle.js:74427 Uncaught (in promise) Error: MAC Invalid: 08d6cc414d58d6af6edd785d577643dcee1b52413c5cba6498d424e9de5d8aec != 6c9c7824656b56c75662718afb156a44a7e701932055c291faf1689396a1aee9
    at client-bundle.js:74427
    at client-bundle.js:62753
```